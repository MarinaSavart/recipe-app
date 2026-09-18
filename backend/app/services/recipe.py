from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recipe import Ingredient, Recipe, RecipeLike, Step, Tag
from app.models.user import User
from app.schemas.recipe import RecipeCreate, RecipeUpdate


async def get_or_404(recipe_id: int, db: AsyncSession) -> Recipe:
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


async def attach_like_metadata(
    recipes: Recipe | list[Recipe],
    db: AsyncSession,
    current_user: User | None,
) -> None:
    """
    Annote chaque recette avec `is_liked` et `likes_count` (attributs transitoires,
    non persistés) pour que RecipeOut / RecipeListItem puissent les sérialiser.
    """
    items = recipes if isinstance(recipes, list) else [recipes]
    if not items:
        return

    recipe_ids = [r.id for r in items]

    counts_result = await db.execute(
        select(RecipeLike.recipe_id, func.count(RecipeLike.id))
        .where(RecipeLike.recipe_id.in_(recipe_ids))
        .group_by(RecipeLike.recipe_id)
    )
    counts_by_id = dict(counts_result.all())

    liked_ids: set[int] = set()
    if current_user:
        liked_result = await db.execute(
            select(RecipeLike.recipe_id).where(
                RecipeLike.recipe_id.in_(recipe_ids),
                RecipeLike.user_id == current_user.id,
            )
        )
        liked_ids = set(liked_result.scalars().all())

    for recipe in items:
        recipe.likes_count = counts_by_id.get(recipe.id, 0)
        recipe.is_liked = recipe.id in liked_ids


async def like_recipe(recipe_id: int, user_id: int, db: AsyncSession) -> None:
    """Like idempotent : si le like existe déjà, ne crée pas de doublon."""
    existing = await db.execute(
        select(RecipeLike).where(
            RecipeLike.recipe_id == recipe_id, RecipeLike.user_id == user_id
        )
    )
    if existing.scalar_one_or_none():
        return

    db.add(RecipeLike(recipe_id=recipe_id, user_id=user_id))
    await db.flush()


async def unlike_recipe(recipe_id: int, user_id: int, db: AsyncSession) -> None:
    """Supprime un like. Lève une 404 s'il n'existe pas."""
    result = await db.execute(
        select(RecipeLike).where(
            RecipeLike.recipe_id == recipe_id, RecipeLike.user_id == user_id
        )
    )
    like = result.scalar_one_or_none()
    if not like:
        raise HTTPException(status_code=404, detail="Like introuvable")

    await db.delete(like)


async def get_liked_recipes(user_id: int, db: AsyncSession) -> list[Recipe]:
    """Recettes likées par l'utilisateur, de la plus récemment likée à la plus ancienne."""
    result = await db.execute(
        select(Recipe)
        .join(RecipeLike, RecipeLike.recipe_id == Recipe.id)
        .where(RecipeLike.user_id == user_id)
        .order_by(RecipeLike.created_at.desc())
    )
    return list(result.scalars().all())


def ensure_owner(recipe: Recipe, user: User) -> None:
    """Lève une 403 si l'utilisateur courant n'est pas le propriétaire de la recette."""
    if recipe.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu n'es pas autorisé à modifier cette recette",
        )


async def save_recipe(
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


async def apply_update(recipe: Recipe, payload: RecipeUpdate, db: AsyncSession) -> Recipe:
    """
    Applique un RecipeUpdate à une recette existante. Seuls les champs envoyés
    sont modifiés (PATCH). Pour les ingrédients/étapes/tags : remplacement
    complet si fournis.
    """
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
    return recipe
