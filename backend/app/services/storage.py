import asyncio
import logging
import os
import uuid
from pathlib import Path

import httpx
from fastapi import HTTPException, UploadFile

from app.models.recipe import Recipe
from app.services import safe_http

logger = logging.getLogger(__name__)

UPLOADS_DIR = Path("uploads")

# Extension derived from the validated content-type, never from the client-supplied filename
CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024


async def save_recipe_photo(recipe: Recipe, file: UploadFile) -> str:
    """
    Validates and stores the uploaded photo for a recipe in /uploads,
    deletes the old local photo if needed, and returns the new
    thumbnail_url value (doesn't persist the recipe — the caller's responsibility).
    """
    if file.content_type not in CONTENT_TYPE_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail="Format non supporté. Utilise JPG, PNG ou WebP.",
        )

    contents = await file.read()
    if len(contents) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=422, detail="Image trop lourde (max 5MB)")

    # Unique name to avoid collisions; extension based on the validated content-type,
    # never on the client-supplied filename (unreliable / potential attack vector)
    ext = CONTENT_TYPE_EXTENSIONS[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOADS_DIR / filename

    if recipe.thumbnail_url and recipe.thumbnail_url.startswith("/uploads/"):
        await asyncio.to_thread(_delete_if_exists, Path(recipe.thumbnail_url.lstrip("/")))

    await asyncio.to_thread(filepath.write_bytes, contents)

    return f"/uploads/{filename}"


async def save_remote_thumbnail(url: str | None) -> str | None:
    """
    Downloads a remote thumbnail (e.g. Instagram/TikTok CDN, whose signed URLs
    expire after a few days) into /uploads and returns the local thumbnail_url.
    Falls back to the original URL if the download fails or the file is invalid,
    so a thumbnail problem never blocks the import.
    """
    if not url or not url.startswith("https://"):
        return url

    # Website imports bring arbitrary image URLs: fetched with the SSRF checks
    try:
        image = await safe_http.fetch(url, MAX_PHOTO_SIZE_BYTES)
    except (httpx.HTTPError, ValueError):
        logger.warning("Thumbnail download failed, keeping remote URL", exc_info=True)
        return url

    if image.content_type not in CONTENT_TYPE_EXTENSIONS:
        logger.warning("Unsupported thumbnail content-type: %s", image.content_type)
        return url

    filename = f"{uuid.uuid4().hex}.{CONTENT_TYPE_EXTENSIONS[image.content_type]}"
    await asyncio.to_thread((UPLOADS_DIR / filename).write_bytes, image.body)

    return f"/uploads/{filename}"


def _delete_if_exists(path: Path) -> None:
    if path.exists():
        os.remove(path)
