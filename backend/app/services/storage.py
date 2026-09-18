import asyncio
import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.models.recipe import Recipe

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


def _delete_if_exists(path: Path) -> None:
    if path.exists():
        os.remove(path)
