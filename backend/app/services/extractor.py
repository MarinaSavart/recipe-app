import asyncio
import logging
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import yt_dlp

logger = logging.getLogger(__name__)

@dataclass
class ExtractedData:
    """Raw data extracted from the video"""
    description: str
    title: Optional[str]
    author: Optional[str]
    thumbnail_url: Optional[str]
    platform: str
    source_url: str


def _detect_platform(url: str) -> str:
    """Detects the platform from the URL's domain"""
    domain = urlparse(url).netloc.lower()
    if "instagram.com" in domain:
        return "instagram"
    if "tiktok.com" in domain:
        return "tiktok"
    if "youtube.com" in domain or "youtu.be" in domain:
        return "youtube"
    return "unknown"


ALLOWED_DOMAINS = {
    "instagram.com", "www.instagram.com",
    "tiktok.com", "www.tiktok.com", "vm.tiktok.com",
    "youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com",
}


def _validate_domain(url: str) -> None:
    """
    Restricts extraction to Instagram/TikTok/YouTube domains to prevent an
    arbitrary URL from making yt-dlp perform a server-side request (SSRF).
    """
    parsed = urlparse(url)
    if parsed.hostname not in ALLOWED_DOMAINS:
        raise ValueError(
            f"Domaine non autorisé : {parsed.hostname}. "
            "Seuls Instagram, TikTok et YouTube sont supportés."
        )


BROWSERS = [
    "firefox",
    "chrome",
    "edge",
    "chromium",
    "brave",
    "opera",
]

def _extract_sync(url: str, platform: str) -> dict:
    """
    Tries several browsers to retrieve cookies.
    Useful for Instagram / TikTok content that requires a session.

    Most YouTube public videos don't require cookies, so it's tried
    without them first. Some videos still trigger YouTube's bot check
    ("Please sign in") even when public, so on failure we fall back to
    the same browser-cookie loop used for Instagram/TikTok.
    """
    if platform not in ("instagram", "tiktok"):
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)
        except yt_dlp.utils.YoutubeDLError as e:
            logger.debug("Failed without cookies: %s. Retrying with browser cookies.", e)

    last_error = None
    for browser in BROWSERS:
        try:
            logger.debug("Attempting with cookies: %s", browser)
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "extract_flat": False,
                "cookiesfrombrowser": (browser,),
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
            logger.debug("Success with cookies: %s", browser)
            return info
        except (yt_dlp.utils.YoutubeDLError, OSError) as e:
            # OSError also covers a browser not being installed
            # (FileNotFoundError on its cookie database).
            logger.debug("Failed with cookies %s: %s", browser, e)
            last_error = e
            continue

    raise RuntimeError(f"Aucun navigateur valide trouvé. Dernière erreur : {last_error}")

async def extract_from_url(url: str) -> ExtractedData:
    """
    Extracts the metadata of an Instagram/TikTok reel or a YouTube video.

    We use run_in_executor to run the synchronous yt-dlp code
    in a separate thread without blocking FastAPI's event loop.
    """
    # url can be a pydantic.HttpUrl (not compatible with urlparse/yt-dlp): we
    # normalize it to str before any validation or processing.
    url = str(url)

    # Domain validation BEFORE any call to yt-dlp (and before loading browser
    # cookies) to prevent an SSRF via an arbitrary URL.
    _validate_domain(url)

    platform = _detect_platform(url)

    info = await asyncio.to_thread(_extract_sync, url, platform)

    description = info.get("description") or info.get("title") or ""
    title = info.get("title") or info.get("fulltitle")
    author = info.get("uploader") or info.get("channel") or info.get("creator")
    thumbnail = info.get("thumbnail")

    if not description:
        raise ValueError(
            "Aucune description trouvée pour cette URL. "
            "Essaie le mode import manuel à la place."
        )

    if platform == "youtube" and len(description) < 100:
        logger.warning(
            "Description YouTube courte (%d chars) — "
            "la recette est peut-être dans les commentaires épinglés.",
            len(description)
        )

    return ExtractedData(
        description=description,
        title=title,
        author=author,
        thumbnail_url=thumbnail,
        platform=platform,
        source_url=url,
    )