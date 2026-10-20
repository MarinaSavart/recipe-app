from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.recipe import RecipeListItem

MAX_MEALS_PER_MENU = 28


# ── Output ─────────────────────────────────────────────────────────────────────

class MenuItemOut(BaseModel):
    id: int
    portions: int  # number of meals covered by this recipe
    position: int
    recipe: RecipeListItem | None
    model_config = ConfigDict(from_attributes=True)


class MenuOut(BaseModel):
    id: int
    name: str
    meals_count: int
    created_at: datetime
    updated_at: datetime
    items: list[MenuItemOut]
    # Sharing (attached by the service): is the current user the owner, and how many guests joined
    is_owner: bool
    owner_name: str
    guests_count: int
    model_config = ConfigDict(from_attributes=True)


class MenuListItem(BaseModel):
    id: int
    name: str
    meals_count: int
    recipes_count: int
    created_at: datetime
    is_owner: bool
    owner_name: str
    guests_count: int
    model_config = ConfigDict(from_attributes=True)


class MenuGuestOut(BaseModel):
    """A user the menu is shared with (shown to the owner)."""
    id: int
    name: str | None
    email: str
    model_config = ConfigDict(from_attributes=True)


class MenuShareLinkOut(BaseModel):
    token: str  # the frontend builds the invitation URL /menus/join/<token>


# ── Input ──────────────────────────────────────────────────────────────────────

class MenuGenerateRequest(BaseModel):
    # automatic generation by the LLM
    name: str = Field(min_length=1, max_length=255)
    meals_count: int = Field(ge=1, le=MAX_MEALS_PER_MENU)


class MenuItemCreate(BaseModel):
    # manual add / replacement of a recipe
    recipe_id: int
    portions: int | None = Field(default=None, ge=1)  # defaults to the recipe's own servings


class MenuUpdate(BaseModel):
    # rename a menu
    name: str = Field(min_length=1, max_length=255)


# ── Shopping list ──────────────────────────────────────────────────────────────

class ShoppingListItem(BaseModel):
    name: str
    quantity: float | None  # total scaled to the menu's portions, None if not measurable
    unit: str | None
    aisle: str | None       # store aisle key, None when the ingredients aren't enriched yet
    extras: list[str]       # quantities that couldn't be added up, as written ("quelques gouttes")
    recipes: list[str]      # titles of the recipes that need this ingredient
    model_config = ConfigDict(from_attributes=True)
