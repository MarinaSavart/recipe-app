import asyncio
import logging
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import yt_dlp

logger = logging.getLogger(__name__)

@dataclass
class ExtractedData:
    """Données brutes extraites de la vidéo"""
    description: str
    title: Optional[str]
    author: Optional[str]
    thumbnail_url: Optional[str]
    platform: str
    source_url: str


def _detect_platform(url: str) -> str:
    """Détecte la plateforme depuis le domaine de l'URL"""
    domain = urlparse(url).netloc.lower()
    if "instagram.com" in domain:
        return "instagram"
    if "tiktok.com" in domain:
        return "tiktok"
    return "unknown"


ALLOWED_DOMAINS = {
    "instagram.com", "www.instagram.com",
    "tiktok.com", "www.tiktok.com", "vm.tiktok.com",
}


def _validate_domain(url: str) -> None:
    """
    Restreint l'extraction aux domaines Instagram/TikTok pour éviter qu'une URL
    arbitraire ne fasse effectuer une requête serveur (SSRF) par yt-dlp.
    """
    parsed = urlparse(url)
    if parsed.hostname not in ALLOWED_DOMAINS:
        raise ValueError(
            f"Domaine non autorisé : {parsed.hostname}. "
            "Seuls Instagram et TikTok sont supportés."
        )


BROWSERS = [
    "firefox",
    "chrome",
    "edge",
    "chromium",
    "brave",
    "opera",
]

def _extract_sync(url: str) -> dict:
    """
    Essaie plusieurs navigateurs pour récupérer les cookies.
    Utile pour Instagram / contenus nécessitant une session.
    """
    last_error = None
    for browser in BROWSERS:
        try:
            logger.debug("Tentative avec cookies: %s", browser)
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "extract_flat": False,
                "cookiesfrombrowser": (browser,),
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
            logger.debug("Succès avec cookies: %s", browser)
            return info
        except yt_dlp.utils.YoutubeDLError as e:
            logger.debug("Échec avec cookies %s: %s", browser, e)
            last_error = e
            continue

    raise RuntimeError(f"Aucun navigateur valide trouvé. Dernière erreur : {last_error}")

async def extract_from_url(url: str) -> ExtractedData:
    """
    Extrait les métadonnées d'un reel Instagram ou TikTok.

    On utilise run_in_executor pour exécuter le code synchrone yt-dlp
    dans un thread séparé sans bloquer la boucle d'événements FastAPI.
    """
    # url peut être un pydantic.HttpUrl (non compatible avec urlparse/yt-dlp) : on le
    # normalise en str avant toute validation ou traitement.
    url = str(url)

    # Validation du domaine AVANT tout appel à yt-dlp (et avant le chargement des
    # cookies navigateur) pour empêcher un SSRF via une URL arbitraire.
    _validate_domain(url)

    info = await asyncio.to_thread(_extract_sync, url)

    description = info.get("description") or info.get("title") or ""
    title = info.get("title") or info.get("fulltitle")
    author = info.get("uploader") or info.get("channel") or info.get("creator")
    thumbnail = info.get("thumbnail")
    platform = _detect_platform(url)

    if not description:
        raise ValueError(
            "Aucune description trouvée pour cette URL. "
            "Essaie le mode import manuel à la place."
        )

    return ExtractedData(
        description=description,
        title=title,
        author=author,
        thumbnail_url=thumbnail,
        platform=platform,
        source_url=url,
    )