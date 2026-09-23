from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu import Menu, MenuItem
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.menu import MenuItemCreate
from app.services import recipe as recipe_service

# Keeps the Ollama prompt within a reasonable context size
MAX_RECIPES_FOR_GENERATION = 60
# Generated menus are made of main-meal recipes (extras of any category can be added by hand)
MENU_CATEGORY = "repas"


async def list_menus(user_id: int, db: AsyncSession) -> list[dict]:
    """The user's menus with their recipe count, most recent first."""
    recipes_count = (
        select(func.count(MenuItem.id))
        .where(MenuItem.menu_id == Menu.id)
        .correlate(Menu)
        .scalar_subquery()
    )
    result = await db.execute(
        select(Menu.id, Menu.name, Menu.meals_count, Menu.created_at, recipes_count.label("recipes_count"))
        .where(Menu.user_id == user_id)
        .order_by(Menu.created_at.desc())
    )
    return [dict(row._mapping) for row in result.all()]


async def get_owned_or_404(menu_id: int, user: User, db: AsyncSession) -> Menu:
    """
    Fetches a menu (without its items). Raises a 404 if it doesn't exist,
    a 403 if it belongs to another user.
    """
    menu = await db.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=404, detail="Menu introuvable")
    if menu.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu n'es pas autorisé à accéder à ce menu",
        )
    return menu


async def get_full(menu_id: int, user: User, db: AsyncSession) -> Menu:
    """
    Loads a menu with its items and their recipes (fresh from the DB),
    with like metadata attached so recipes serialize as RecipeListItem.
    """
    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
        .execution_options(populate_existing=True)
    )
    menu = result.scalar_one()

    recipes = list({item.recipe.id: item.recipe for item in menu.items if item.recipe}.values())
    await recipe_service.attach_like_metadata(recipes, db, user)
    return menu


async def get_generation_recipes(db: AsyncSession) -> list[dict]:
    """
    "Repas" recipes offered to the generator, in the compact shape sent to Ollama.
    Recipes with nutritional info come first, then the most recent ones.
    """
    result = await db.execute(
        select(Recipe)
        .where(Recipe.category == MENU_CATEGORY)
        .order_by(Recipe.calories.is_(None), Recipe.created_at.desc())
        .limit(MAX_RECIPES_FOR_GENERATION)
    )
    return [
        {
            "id": r.id,
            "title": r.title,
            "portions": r.servings,
            "calories": r.calories,
            "proteins_g": r.proteins_g,
            "carbs_g": r.carbs_g,
            "fats_g": r.fats_g,
        }
        for r in result.scalars().all()
    ]


async def create_with_items(
    user_id: int, name: str, meals_count: int, items: list[dict], db: AsyncSession
) -> Menu:
    """Creates a menu and its items (already validated) in the current transaction."""
    menu = Menu(user_id=user_id, name=name, meals_count=meals_count)
    db.add(menu)
    await db.flush()

    for item in items:
        db.add(MenuItem(menu_id=menu.id, **item))

    await db.flush()
    return menu


async def rename(menu: Menu, name: str, db: AsyncSession) -> None:
    menu.name = name
    await db.flush()


async def _get_recipe_or_404(recipe_id: int, db: AsyncSession) -> Recipe:
    recipe = await db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    return recipe


def _portions(payload: MenuItemCreate, recipe: Recipe) -> int:
    """Meals covered: as requested, else one batch of the recipe."""
    return payload.portions or recipe.servings or 1


async def _get_item_or_404(menu: Menu, item_id: int, db: AsyncSession) -> MenuItem:
    result = await db.execute(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.menu_id == menu.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Repas introuvable")
    return item


def _touch(menu: Menu) -> None:
    """Item changes don't update the menus row, so bump updated_at explicitly."""
    menu.updated_at = func.now()


async def _find_recipe_item(menu: Menu, recipe_id: int, db: AsyncSession) -> MenuItem | None:
    """The menu's line for this recipe, if it's already in the menu (one line per recipe)."""
    result = await db.execute(
        select(MenuItem).where(MenuItem.menu_id == menu.id, MenuItem.recipe_id == recipe_id)
    )
    return result.scalars().first()


async def add_item(menu: Menu, payload: MenuItemCreate, db: AsyncSession) -> MenuItem:
    """Adds a recipe at the end of the menu, or more portions of it if it's already there."""
    recipe = await _get_recipe_or_404(payload.recipe_id, db)
    existing = await _find_recipe_item(menu, recipe.id, db)
    if existing:
        existing.portions += _portions(payload, recipe)
        _touch(menu)
        await db.flush()
        return existing

    last_position = await db.scalar(
        select(func.max(MenuItem.position)).where(MenuItem.menu_id == menu.id)
    )
    item = MenuItem(
        menu_id=menu.id,
        recipe_id=recipe.id,
        portions=_portions(payload, recipe),
        position=(last_position + 1) if last_position is not None else 0,
    )
    db.add(item)
    _touch(menu)
    await db.flush()
    return item


async def update_item(menu: Menu, item_id: int, payload: MenuItemCreate, db: AsyncSession) -> MenuItem:
    """
    Replaces an item's recipe (and its portions), keeping its position.
    If the new recipe is already in the menu, its line gets the portions instead.
    """
    item = await _get_item_or_404(menu, item_id, db)
    recipe = await _get_recipe_or_404(payload.recipe_id, db)
    existing = await _find_recipe_item(menu, recipe.id, db)
    if existing and existing.id != item.id:
        existing.portions += _portions(payload, recipe)
        await db.delete(item)
        _touch(menu)
        await db.flush()
        return existing

    item.recipe_id = recipe.id
    item.portions = _portions(payload, recipe)
    _touch(menu)
    await db.flush()
    return item


async def delete_item(menu: Menu, item_id: int, db: AsyncSession) -> None:
    item = await _get_item_or_404(menu, item_id, db)
    await db.delete(item)
    _touch(menu)
    await db.flush()
