from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.recipe import Ingredient, Recipe, Step, Tag
from app.schemas.recipe import (
    ImportRequest,
    RecipeCreate,
    RecipeListItem,
    RecipeOut,
    RecipeUpdate,
)
from app.services.claude import parse_recipe
from app.services.extractor import extract_from_url

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

router = APIRouter(prefix="/recipes", tags=["recipes"])


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_recipe_or_404(recipe_id: int, db: AsyncSession) -> Recipe:
    """
    Récupère une recette par son id avec toutes ses relations.
    Lève une 404 si elle n'existe pas.
    """
    result = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.ingredients),
            selectinload(Recipe.steps),
            selectinload(Recipe.tags),
        )
        .where(Recipe.id == recipe_id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    return recipe


async def _save_recipe(
    recipe_data: RecipeCreate,
    db: AsyncSession,
    source_url: str | None = None,
    source_platform: str | None = None,
    source_author: str | None = None,
    thumbnail_url: str | None = None,
) -> Recipe:
    """
    Sauvegarde une RecipeCreate en base — recette + ingrédients + étapes + tags.
    """
    # 1. Crée la recette principale
    recipe = Recipe(
        title=recipe_data.title,
        description=recipe_data.description,
        raw_description=recipe_data.raw_description,
        source_url=source_url,
        source_platform=source_platform,
        source_author=source_author,
        thumbnail_url=thumbnail_url,
        servings=recipe_data.servings,
        prep_time_minutes=recipe_data.prep_time_minutes,
        cook_time_minutes=recipe_data.cook_time_minutes,
        calories=recipe_data.calories,
        proteins_g=recipe_data.proteins_g,
        carbs_g=recipe_data.carbs_g,
        fats_g=recipe_data.fats_g,
    )
    db.add(recipe)
    await db.flush()  # flush pour obtenir l'id sans encore committer

    # 2. Ajoute les ingrédients
    for ing in recipe_data.ingredients:
        db.add(Ingredient(recipe_id=recipe.id, **ing.model_dump()))

    # 3. Ajoute les étapes
    for step in recipe_data.steps:
        db.add(Step(recipe_id=recipe.id, **step.model_dump()))

    # 4. Ajoute les tags
    for name in recipe_data.tags:
        db.add(Tag(recipe_id=recipe.id, name=name))

    await db.flush()
    return recipe


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/import", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def import_from_url(payload: ImportRequest, db: AsyncSession = Depends(get_db)):
    """
    Import automatique depuis une URL Instagram ou TikTok.
    Étapes :
      1. yt-dlp extrait la description et les métadonnées
      2. Claude parse la description en recette structurée
      3. On sauvegarde en base et on retourne la recette
    """
    # Étape 1 : extraction
    try:
        extracted = await extract_from_url(payload.url)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Extraction échouée : {str(e)}"
        )

    # Étape 2 : parsing Claude
    try:
        recipe_data = await parse_recipe(
            extracted.description,
            suggested_title=extracted.title
        )
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Parsing Claude échoué : {str(e)}"
        )

    # Étape 3 : sauvegarde
    recipe = await _save_recipe(
        recipe_data,
        db,
        source_url=extracted.source_url,
        source_platform=extracted.platform,
        source_author=extracted.author,
        thumbnail_url=extracted.thumbnail_url,
    )

    return await _get_recipe_or_404(recipe.id, db)


@router.post("/import/manual", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def import_manual(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Import manuel : l'utilisateur colle directement la description.
    Utile quand yt-dlp échoue sur un compte privé.
    """
    description = payload.get("description", "").strip()
    if not description:
        raise HTTPException(status_code=422, detail="La description est vide")

    try:
        recipe_data = await parse_recipe(description)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Parsing Claude échoué : {str(e)}"
        )

    recipe = await _save_recipe(
        recipe_data,
        db,
        source_url=payload.get("source_url"),
        source_platform="manual",
    )

    return await _get_recipe_or_404(recipe.id, db)


@router.get("/", response_model=list[RecipeListItem])
async def list_recipes(db: AsyncSession = Depends(get_db)):
    """
    Retourne toutes les recettes, version allégée (sans ingrédients/étapes).
    Triées de la plus récente à la plus ancienne.
    """
    result = await db.execute(
        select(Recipe).order_by(Recipe.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(recipe_id: int, db: AsyncSession = Depends(get_db)):
    """Retourne une recette complète avec ingrédients, étapes et tags."""
    return await _get_recipe_or_404(recipe_id, db)


@router.patch("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: int,
    payload: RecipeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Met à jour une recette. Seuls les champs envoyés sont modifiés (PATCH).
    Pour les ingrédients/étapes/tags : remplacement complet si fournis.
    """
    recipe = await _get_recipe_or_404(recipe_id, db)
    update_data = payload.model_dump(exclude_unset=True)

    # Champs simples
    for field in ["title", "description", "servings", "prep_time_minutes",
                  "cook_time_minutes", "calories", "proteins_g", "carbs_g", "fats_g"]:
        if field in update_data:
            setattr(recipe, field, update_data[field])

    # Remplacement complet des ingrédients si fournis
    if "ingredients" in update_data:
        for ing in recipe.ingredients:
            await db.delete(ing)
        for ing in payload.ingredients:
            db.add(Ingredient(recipe_id=recipe.id, **ing.model_dump()))

    # Remplacement complet des étapes si fournies
    if "steps" in update_data:
        for step in recipe.steps:
            await db.delete(step)
        for step in payload.steps:
            db.add(Step(recipe_id=recipe.id, **step.model_dump()))

    # Remplacement complet des tags si fournis
    if "tags" in update_data:
        for tag in recipe.tags:
            await db.delete(tag)
        for name in payload.tags:
            db.add(Tag(recipe_id=recipe.id, name=name))

    await db.flush()
    return await _get_recipe_or_404(recipe.id, db)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(recipe_id: int, db: AsyncSession = Depends(get_db)):
    """
    Supprime une recette et tout ce qui lui est lié
    (ingrédients/étapes/tags supprimés automatiquement par le cascade).
    """
    recipe = await _get_recipe_or_404(recipe_id, db)
    await db.delete(recipe)

UPLOADS_DIR = Path("uploads")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

@router.post("/{recipe_id}/photo", response_model=RecipeOut)
async def upload_photo(
    recipe_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload une photo pour une recette.
    Stocke le fichier dans /uploads et met à jour thumbnail_url en base.
    """
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Format non supporté. Utilise JPG, PNG ou WebP."
        )

    # Limite à 5MB
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Image trop lourde (max 5MB)")

    # Nom unique pour éviter les collisions
    ext = file.filename.split(".")[-1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOADS_DIR / filename

    # Supprime l'ancienne photo si elle était uploadée localement
    recipe = await _get_recipe_or_404(recipe_id, db)
    if recipe.thumbnail_url and recipe.thumbnail_url.startswith("/uploads/"):
        old_path = Path(recipe.thumbnail_url.lstrip("/"))
        if old_path.exists():
            os.remove(old_path)

    # Sauvegarde le fichier
    with open(filepath, "wb") as f:
        f.write(contents)

    # Met à jour la recette
    recipe.thumbnail_url = f"/uploads/{filename}"
    await db.flush()

    return await _get_recipe_or_404(recipe_id, db)