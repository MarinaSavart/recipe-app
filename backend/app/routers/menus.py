import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.menu import (
    MenuGenerateRequest,
    MenuItemCreate,
    MenuListItem,
    MenuOut,
    MenuUpdate,
)
from app.services import menu as menu_service
from app.services import user_goals as goals_service
from app.services.menu_generator import generate_menu

router = APIRouter(prefix="/menus", tags=["menus"])
logger = logging.getLogger(__name__)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[MenuListItem])
async def list_menus(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current user's menus, most recent first."""
    return await menu_service.list_menus(current_user.id, db)


@router.post("/generate", response_model=MenuOut, status_code=status.HTTP_201_CREATED)
async def generate(
    payload: MenuGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a menu of `meals_count` meals with Ollama.
    Steps:
      1. Load the "repas" recipes offered to the generator (all users' recipes)
      2. Load the user's per-meal nutritional targets (defaults if not defined)
      3. Ask Ollama to pick recipes covering exactly that number of meals
      4. Save the menu and its items, and return it
    """
    recipes = await menu_service.get_generation_recipes(db)
    goals = await goals_service.get_meal_targets(current_user.id, db)

    try:
        items = await generate_menu(payload, recipes, goals)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except httpx.HTTPError:
        logger.exception("Ollama call failed during menu generation")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La génération du menu a échoué. Vérifie qu'Ollama tourne et réessaie.",
        )

    menu = await menu_service.create_with_items(
        current_user.id, payload.name, payload.meals_count, items, db
    )
    return await menu_service.get_full(menu.id, current_user, db)


@router.get("/{menu_id}", response_model=MenuOut)
async def get_menu(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A full menu with its items and recipes (owner only)."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.patch("/{menu_id}", response_model=MenuOut)
async def rename_menu(
    menu_id: int,
    payload: MenuUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Renames a menu (owner only)."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    await menu_service.rename(menu, payload.name, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes a menu (owner only); its items are deleted via cascade."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    await db.delete(menu)


@router.post("/{menu_id}/items", response_model=MenuOut, status_code=status.HTTP_201_CREATED)
async def add_menu_item(
    menu_id: int,
    payload: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adds a recipe to a menu (owner only)."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    await menu_service.add_item(menu, payload, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.patch("/{menu_id}/items/{item_id}", response_model=MenuOut)
async def update_menu_item(
    menu_id: int,
    item_id: int,
    payload: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replaces a recipe of a menu (owner only)."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    await menu_service.update_item(menu, item_id, payload, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.delete("/{menu_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(
    menu_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Removes a recipe from a menu (owner only)."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    await menu_service.delete_item(menu, item_id, db)
