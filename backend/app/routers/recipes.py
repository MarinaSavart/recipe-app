import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.recipe import Ingredient, Recipe, Step, Tag
from app.models.user import User
from app.schemas.recipe import (
    ImportRequest,
    RecipeCreate,
    RecipeListItem,
    RecipeOut,
    RecipeUpdate,
)
from app.services.claude import parse_recipe
from app.services.extractor import extract_from_url

router = APIRouter(prefix="/recipes", tags=["recipes"])
logger = logging.getLogger(__name__)


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


def _ensure_owner(recipe: Recipe, user: User) -> None:
    """Lève une 403 si l'utilisateur courant n'est pas le propriétaire de la recette."""
    if recipe.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu n'es pas autorisé à modifier cette recette",
        )


async def _save_recipe(
    recipe_data: RecipeCreate,
    db: AsyncSession,
    user_id: int,
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
        user_id=user_id,
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
async def import_from_url(
    payload: ImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    except ValueError as e:
        # Erreur attendue et déjà formulée pour l'utilisateur (ex: pas de description trouvée)
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception:
        logger.exception("Extraction échouée pour l'URL %s", payload.url)
        raise HTTPException(
            status_code=422,
            detail="Extraction échouée. Vérifie l'URL ou utilise l'import manuel.",
        )

    # Étape 2 : parsing Claude
    try:
        recipe_data = await parse_recipe(
            extracted.description,
            suggested_title=extracted.title
        )
    except Exception:
        logger.exception("Parsing de la recette échoué")
        raise HTTPException(
            status_code=422,
            detail="Le parsing de la recette a échoué. Réessaie ou utilise l'import manuel.",
        )

    # Étape 3 : sauvegarde
    recipe = await _save_recipe(
        recipe_data,
        db,
        user_id=current_user.id,
        source_url=extracted.source_url,
        source_platform=extracted.platform,
        source_author=extracted.author,
        thumbnail_url=extracted.thumbnail_url,
    )

    return await _get_recipe_or_404(recipe.id, db)


@router.post("/import/manual", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def import_manual(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import manuel : l'utilisateur colle directement la description.
    Utile quand yt-dlp échoue sur un compte privé.
    """
    description = payload.get("description", "").strip()
    if not description:
        raise HTTPException(status_code=422, detail="La description est vide")

    try:
        recipe_data = await parse_recipe(description)
    except Exception:
        logger.exception("Parsing de la recette échoué")
        raise HTTPException(
            status_code=422,
            detail="Le parsing de la recette a échoué. Réessaie ou utilise l'import manuel.",
        )

    recipe = await _save_recipe(
        recipe_data,
        db,
        user_id=current_user.id,
        source_url=payload.get("source_url"),
        source_platform="manual",
    )

    return await _get_recipe_or_404(recipe.id, db)


@router.get("/", response_model=list[RecipeListItem])
async def list_recipes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retourne toutes les recettes (visibles par tout utilisateur connecté),
    version allégée (sans ingrédients/étapes). Triées de la plus récente à la plus ancienne.
    """
    result = await db.execute(
        select(Recipe).order_by(Recipe.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne une recette complète avec ingrédients, étapes et tags (visible par tout utilisateur connecté)."""
    return await _get_recipe_or_404(recipe_id, db)


@router.patch("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: int,
    payload: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Met à jour une recette (propriétaire uniquement). Seuls les champs envoyés
    sont modifiés (PATCH). Pour les ingrédients/étapes/tags : remplacement
    complet si fournis.
    """
    recipe = await _get_recipe_or_404(recipe_id, db)
    _ensure_owner(recipe, current_user)
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
async def delete_recipe(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Supprime une recette (propriétaire uniquement) et tout ce qui lui est lié
    (ingrédients/étapes/tags supprimés automatiquement par le cascade).
    """
    recipe = await _get_recipe_or_404(recipe_id, db)
    _ensure_owner(recipe, current_user)
    await db.delete(recipe)

UPLOADS_DIR = Path("uploads")
# Extension dérivée du content-type validé, jamais du nom de fichier fourni par le client
CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

@router.post("/{recipe_id}/photo", response_model=RecipeOut)
async def upload_photo(
    recipe_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload une photo pour une recette (propriétaire uniquement).
    Stocke le fichier dans /uploads et met à jour thumbnail_url en base.
    """
    recipe = await _get_recipe_or_404(recipe_id, db)
    _ensure_owner(recipe, current_user)

    if file.content_type not in CONTENT_TYPE_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail="Format non supporté. Utilise JPG, PNG ou WebP."
        )

    # Limite à 5MB
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Image trop lourde (max 5MB)")

    # Nom unique pour éviter les collisions ; extension basée sur le content-type validé,
    # jamais sur le nom de fichier fourni par le client (non fiable / potentiel vecteur d'abus)
    ext = CONTENT_TYPE_EXTENSIONS[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOADS_DIR / filename

    # Supprime l'ancienne photo si elle était uploadée localement
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