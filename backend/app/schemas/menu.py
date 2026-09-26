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
    model_config = ConfigDict(from_attributes=True)


class MenuListItem(BaseModel):
    id: int
    name: str
    meals_count: int
    recipes_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Input ──────────────────────────────────────────────────────────────────────

class MenuGenerateRequest(BaseModel):
    # automatic generation by Ollama
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
