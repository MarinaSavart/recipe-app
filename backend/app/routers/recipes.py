import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
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
    recipe = await recipe_service.save_recipe(
        recipe_data,
        db,
        user_id=current_user.id,
        source_url=extracted.source_url,
        source_platform=extracted.platform,
        source_author=extracted.author,
        thumbnail_url=extracted.thumbnail_url,
    )

    return await recipe_service.get_or_404(recipe.id, db)


@router.post("/import/manual", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def import_manual(
    payload: ImportManualRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import manuel : l'utilisateur colle directement la description.
    Utile quand yt-dlp échoue sur un compte privé.
    """
    description = payload.description.strip()
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

    recipe = await recipe_service.save_recipe(
        recipe_data,
        db,
        user_id=current_user.id,
        source_url=payload.source_url,
        source_platform="manual",
    )

    return await recipe_service.get_or_404(recipe.id, db)


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
    return await recipe_service.get_or_404(recipe_id, db)


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
    recipe = await recipe_service.get_or_404(recipe_id, db)
    recipe_service.ensure_owner(recipe, current_user)
    recipe = await recipe_service.apply_update(recipe, payload, db)
    return await recipe_service.get_or_404(recipe.id, db)


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
    Upload une photo pour une recette (propriétaire uniquement).
    Stocke le fichier dans /uploads et met à jour thumbnail_url en base.
    """
    recipe = await recipe_service.get_or_404(recipe_id, db)
    recipe_service.ensure_owner(recipe, current_user)

    recipe.thumbnail_url = await storage_service.save_recipe_photo(recipe, file)
    await db.flush()

    return await recipe_service.get_or_404(recipe_id, db)
