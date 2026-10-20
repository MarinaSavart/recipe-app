import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.menu import (
    MenuGenerateRequest,
    MenuGuestOut,
    MenuItemCreate,
    MenuListItem,
    MenuOut,
    MenuShareLinkOut,
    MenuUpdate,
    ShoppingListItem,
)
from app.services import menu as menu_service
from app.services import shopping_list as shopping_list_service
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
    """The current user's menus and the ones shared with them, most recent first."""
    return await menu_service.list_menus(current_user.id, db)


@router.post("/generate", response_model=MenuOut, status_code=status.HTTP_201_CREATED)
async def generate(
    payload: MenuGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a menu of `meals_count` meals with the OpenRouter model.
    Steps:
      1. Load the "repas" recipes offered to the generator (all users' recipes)
      2. Load the user's per-meal nutritional targets (defaults if not defined)
      3. Ask the model to pick recipes covering exactly that number of meals
      4. Save the menu and its items, and return it
    """
    recipes = await menu_service.get_generation_recipes(db)
    goals = await goals_service.get_meal_targets(current_user.id, db)

    try:
        items = await generate_menu(payload, recipes, goals)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except httpx.HTTPError:
        logger.exception("OpenRouter call failed during menu generation")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La génération du menu a échoué. Réessaie dans quelques instants.",
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
    """A full menu with its items and recipes (owner or guest)."""
    menu = await menu_service.get_accessible_or_404(menu_id, current_user, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.get("/{menu_id}/shopping-list", response_model=list[ShoppingListItem])
async def get_shopping_list(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Shopping list of a menu (owner or guest): ingredients scaled to the portions
    used in the menu, merged by name and unit, sorted alphabetically.
    """
    menu = await menu_service.get_accessible_or_404(menu_id, current_user, db)
    items = await menu_service.get_items_with_ingredients(menu.id, db)
    return shopping_list_service.build_shopping_list(items)


@router.patch("/{menu_id}", response_model=MenuOut)
async def rename_menu(
    menu_id: int,
    payload: MenuUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Renames a menu (owner or guest)."""
    menu = await menu_service.get_accessible_or_404(menu_id, current_user, db)
    await menu_service.rename(menu, payload.name, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes a menu (owner only); its items and shares are deleted via cascade."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    await db.delete(menu)


@router.post("/{menu_id}/items", response_model=MenuOut, status_code=status.HTTP_201_CREATED)
async def add_menu_item(
    menu_id: int,
    payload: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adds a recipe to a menu (owner or guest)."""
    menu = await menu_service.get_accessible_or_404(menu_id, current_user, db)
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
    """Replaces a recipe of a menu (owner or guest)."""
    menu = await menu_service.get_accessible_or_404(menu_id, current_user, db)
    await menu_service.update_item(menu, item_id, payload, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.delete("/{menu_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(
    menu_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Removes a recipe from a menu (owner or guest)."""
    menu = await menu_service.get_accessible_or_404(menu_id, current_user, db)
    await menu_service.delete_item(menu, item_id, db)


# ── Sharing ────────────────────────────────────────────────────────────────────

@router.post("/{menu_id}/share-link", response_model=MenuShareLinkOut)
async def get_share_link(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The menu's invitation token, created on first call (owner only)."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    return {"token": await menu_service.get_share_token(menu, db)}


@router.post("/join/{token}", response_model=MenuOut)
async def join_menu(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Joins a menu through its invitation link: it then shows up in the user's menus."""
    menu = await menu_service.join(token, current_user, db)
    return await menu_service.get_full(menu.id, current_user, db)


@router.get("/{menu_id}/shares", response_model=list[MenuGuestOut])
async def list_menu_guests(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The users the menu is shared with (owner only)."""
    menu = await menu_service.get_owned_or_404(menu_id, current_user, db)
    return await menu_service.list_guests(menu, db)


@router.delete("/{menu_id}/shares/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_menu_guest(
    menu_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stops sharing a menu: the owner removes a guest, or a guest leaves the menu
    (user_id = their own id). The menu then disappears from the guest's menus.
    """
    menu = await menu_service.get_accessible_or_404(menu_id, current_user, db)
    await menu_service.remove_guest(menu, user_id, current_user, db)
