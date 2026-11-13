"""
HTTP GET for user-supplied URLs (recipe websites, thumbnails) without SSRF:
the server must never be usable to reach its own network (the database, the
Raspberry Pi's LAN, Tailscale, cloud metadata endpoints...).

Every hop (the URL and each redirect) is checked before the request: http(s) on
the default ports only, and a hostname resolving to public IP addresses only.
Bodies are size-capped and requests time out.

Residual risk: httpx resolves the hostname again when connecting, so a DNS
record switched between the check and the request (DNS rebinding) isn't caught.
"""
import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx

MAX_REDIRECTS = 5
TIMEOUT_SECONDS = 15.0
# Many sites answer 403 to non-browser user agents
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0 Safari/537.36"
)


class UnsafeUrlError(ValueError):
    """The URL points somewhere the server must not request (message shown to the user)."""


@dataclass
class FetchedResponse:
    url: str           # final URL, after redirects
    content_type: str  # without parameters, e.g. "text/html"
    body: bytes


async def _check_public_url(url: str) -> None:
    """Raises UnsafeUrlError unless the URL is http(s) on a default port and resolves to public IPs only."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeUrlError("Lien invalide : seuls les liens http(s) sont acceptés.")
    try:
        port = parsed.port
    except ValueError as exc:
        raise UnsafeUrlError("Lien invalide.") from exc
    if port not in (None, 80, 443):
        raise UnsafeUrlError("Lien non autorisé (port inhabituel).")

    try:
        infos = await asyncio.get_running_loop().getaddrinfo(parsed.hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeUrlError("Site introuvable : vérifie le lien.") from exc

    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped  # "::ffff:127.0.0.1" is loopback
        if not ip.is_global:
            raise UnsafeUrlError("Lien non autorisé (adresse privée).")


async def fetch(url: str, max_bytes: int) -> FetchedResponse:
    """
    GETs a user-supplied URL, following up to MAX_REDIRECTS redirects, each one checked.
    Raises UnsafeUrlError for a forbidden URL, ValueError when the body exceeds
    `max_bytes`, httpx.HTTPError on network or HTTP errors.
    """
    # trust_env=False: no proxy from the environment, so the check above applies to the real target
    async with httpx.AsyncClient(
        timeout=TIMEOUT_SECONDS,
        follow_redirects=False,
        trust_env=False,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"},
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            await _check_public_url(url)
            async with client.stream("GET", url) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise httpx.HTTPError("Redirect without a Location header")
                    url = urljoin(url, location)
                    continue

                response.raise_for_status()
                content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > max_bytes:
                        raise ValueError(f"Response larger than {max_bytes} bytes")
                return FetchedResponse(url=str(response.url), content_type=content_type, body=bytes(body))

    raise UnsafeUrlError("Trop de redirections pour ce lien.")
