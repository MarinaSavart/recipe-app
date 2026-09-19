import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.recipe import (
    ImportManualRequest,
    ImportRequest,
    RecipeListItem,
    RecipeOut,
    RecipeUpdate,
)
from app.services import recipe as recipe_service
from app.services import storage as storage_service
from app.services.claude import parse_recipe
from app.services.extractor import extract_from_url

router = APIRouter(prefix="/recipes", tags=["recipes"])
logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = {
    "breakfast",
    "repas",
    "collation",
    "dessert",
    "snack",
    "boisson",
}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/import", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def import_from_url(
    payload: ImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Automatic import from an Instagram or TikTok URL.
    Steps:
      1. yt-dlp extracts the description and metadata
      2. Claude parses the description into a structured recipe
      3. We save it to the database and return the recipe
    """
    # Step 1: extraction
    try:
        extracted = await extract_from_url(payload.url)
    except ValueError as e:
        # Expected error, already phrased for the user (e.g. no description found)
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception:
        logger.exception("Extraction failed for URL %s", payload.url)
        raise HTTPException(
            status_code=422,
            detail="Extraction échouée. Vérifie l'URL ou utilise l'import manuel.",
        )

    # Step 2: Claude parsing
    try:
        recipe_data = await parse_recipe(
            extracted.description,
            suggested_title=extracted.title
        )
    except Exception:
        logger.exception("Recipe parsing failed")
        raise HTTPException(
            status_code=422,
            detail="Le parsing de la recette a échoué. Réessaie ou utilise l'import manuel.",
        )

    # Step 3: save
    recipe = await recipe_service.save_recipe(
        recipe_data,
        db,
        user_id=current_user.id,
        source_url=extracted.source_url,
        source_platform=extracted.platform,
        source_author=extracted.author,
        thumbnail_url=extracted.thumbnail_url,
    )

    saved_recipe = await recipe_service.get_or_404(recipe.id, db)
    await recipe_service.attach_like_metadata(saved_recipe, db, current_user)
    return saved_recipe


@router.post("/import/manual", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def import_manual(
    payload: ImportManualRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Manual import: the user pastes the description directly.
    Useful when yt-dlp fails on a private account.
    """
    description = payload.description.strip()
    if not description:
        raise HTTPException(status_code=422, detail="La description est vide")

    try:
        recipe_data = await parse_recipe(description)
    except Exception:
        logger.exception("Recipe parsing failed")
        raise HTTPException(
            status_code=422,
            detail="Le parsing de la recette a échoué. Réessaie ou utilise l'import manuel.",
        )

    recipe = await recipe_service.save_recipe(
        recipe_data,
        db,
        user_id=current_user.id,
        # payload.source_url is a pydantic HttpUrl, not a str — the DB driver
        # can't bind it directly, so it must be converted before persisting.
        source_url=str(payload.source_url) if payload.source_url else None,
        source_platform="manual",
    )

    saved_recipe = await recipe_service.get_or_404(recipe.id, db)
    await recipe_service.attach_like_metadata(saved_recipe, db, current_user)
    return saved_recipe


@router.get("/liked", response_model=list[RecipeListItem])
async def list_liked_recipes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recipes liked by the current user, lightweight version.
    Sorted from most recently liked to oldest.
    Declared before /{recipe_id} so "liked" isn't interpreted as an id.
    """
    recipes = await recipe_service.get_liked_recipes(current_user.id, db)
    await recipe_service.attach_like_metadata(recipes, db, current_user)
    return recipes


@router.get("/mine", response_model=list[RecipeListItem])
async def list_my_recipes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recipes imported by the current user, lightweight version.
    Sorted from most recently imported to oldest.
    Declared before /{recipe_id} so "mine" isn't interpreted as an id.
    """
    recipes = await recipe_service.get_own_recipes(current_user.id, db)
    await recipe_service.attach_like_metadata(recipes, db, current_user)
    return recipes


@router.get("/", response_model=list[RecipeListItem])
async def list_recipes(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """
    Returns all recipes (visible to any user, logged in or not),
    lightweight version (no ingredients/steps). Sorted from newest to oldest.
    Optionally filtered by category.
    """
    if category is not None and category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=422, detail="Catégorie invalide")

    query = select(Recipe).order_by(Recipe.created_at.desc())
    if category is not None:
        query = query.where(Recipe.category == category)

    result = await db.execute(query)
    recipes = list(result.scalars().all())
    await recipe_service.attach_like_metadata(recipes, db, current_user)
    return recipes


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Returns a full recipe with ingredients, steps and tags (visible to any user, logged in or not)."""
    recipe = await recipe_service.get_or_404(recipe_id, db)
    await recipe_service.attach_like_metadata(recipe, db, current_user)
    return recipe


@router.post("/{recipe_id}/like", status_code=status.HTTP_200_OK)
async def like_recipe(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Likes a recipe (idempotent: if already liked, does nothing and returns 200)."""
    await recipe_service.get_or_404(recipe_id, db)
    await recipe_service.like_recipe(recipe_id, current_user.id, db)
    return {"status": "ok"}


@router.delete("/{recipe_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_recipe(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unlikes a recipe. Raises a 404 if it wasn't liked."""
    await recipe_service.unlike_recipe(recipe_id, current_user.id, db)


@router.patch("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: int,
    payload: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates a recipe (owner only). Only the fields sent are modified (PATCH).
    For ingredients/steps/tags: fully replaced if provided.
    """
    if payload.category is not None and payload.category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=422, detail="Catégorie invalide")

    recipe = await recipe_service.get_or_404(recipe_id, db)
    recipe_service.ensure_owner(recipe, current_user)
    recipe = await recipe_service.apply_update(recipe, payload, db)
    updated_recipe = await recipe_service.get_or_404(recipe.id, db)
    await recipe_service.attach_like_metadata(updated_recipe, db, current_user)
    return updated_recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deletes a recipe (owner only) and everything linked to it
    (ingredients/steps/tags are automatically deleted via cascade).
    """
    recipe = await recipe_service.get_or_404(recipe_id, db)
    recipe_service.ensure_owner(recipe, current_user)
    await db.delete(recipe)


@router.post("/{recipe_id}/photo", response_model=RecipeOut)
async def upload_photo(
    recipe_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Uploads a photo for a recipe (owner only).
    Stores the file in /uploads and updates thumbnail_url in the database.
    """
    recipe = await recipe_service.get_or_404(recipe_id, db)
    recipe_service.ensure_owner(recipe, current_user)

    recipe.thumbnail_url = await storage_service.save_recipe_photo(recipe, file)
    await db.flush()

    updated_recipe = await recipe_service.get_or_404(recipe_id, db)
    await recipe_service.attach_like_metadata(updated_recipe, db, current_user)
    return updated_recipe
