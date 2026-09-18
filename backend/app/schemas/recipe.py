from datetime import datetime
from typing import Optional

from pydantic import BaseModel, HttpUrl


# ── Import ─────────────────────────────────────────────────────────────────────

class ImportRequest(BaseModel):
    url: HttpUrl


class ImportManualRequest(BaseModel):
    description: str
    source_url: Optional[HttpUrl] = None


# ── Ingredient ─────────────────────────────────────────────────────────────────

class IngredientBase(BaseModel):
    name: str
    quantity: Optional[str] = None  # always a string: "600", "1/2"
    unit: Optional[str] = None      # "g", "ml", "tbsp"...
    notes: Optional[str] = None     # "low-fat", "grated"...
    position: int = 0

class IngredientCreate(IngredientBase):
    pass  # identical to Base for now, but kept separate to evolve independently

class IngredientOut(IngredientBase):
    id: int
    model_config = {"from_attributes": True}  # allows reading from a SQLAlchemy object


# ── Step ───────────────────────────────────────────────────────────────────────

class StepBase(BaseModel):
    content: str
    position: int
    duration_minutes: Optional[int] = None

class StepCreate(StepBase):
    pass

class StepOut(StepBase):
    id: int
    model_config = {"from_attributes": True}


# ── Tag ────────────────────────────────────────────────────────────────────────

class TagOut(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


# ── Recipe ─────────────────────────────────────────────────────────────────────

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    source_url: Optional[HttpUrl] = None
    source_platform: Optional[str] = None
    source_author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    calories: Optional[float] = None
    proteins_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fats_g: Optional[float] = None

class RecipeCreate(RecipeBase):
    # used internally to create a recipe (after Claude parsing)
    ingredients: list[IngredientCreate] = []
    steps: list[StepCreate] = []
    tags: list[str] = []
    raw_description: Optional[str] = None

class RecipeOut(RecipeBase):
    # what the API returns — includes relationships and timestamps
    id: int
    ingredients: list[IngredientOut] = []
    steps: list[StepOut] = []
    tags: list[TagOut] = []
    is_liked: bool
    likes_count: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class RecipeListItem(BaseModel):
    # lightweight version for the list view — no need to load ingredients/steps
    id: int
    title: str
    source_platform: Optional[str] = None
    source_author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    servings: Optional[int] = None
    calories: Optional[float] = None
    proteins_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fats_g: Optional[float] = None
    is_liked: bool
    likes_count: int
    created_at: datetime
    model_config = {"from_attributes": True}

class RecipeUpdate(BaseModel):
    # all fields optional — only what's sent gets updated
    title: Optional[str] = None
    description: Optional[str] = None
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    calories: Optional[float] = None
    proteins_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fats_g: Optional[float] = None
    ingredients: Optional[list[IngredientCreate]] = None
    steps: Optional[list[StepCreate]] = None
    tags: Optional[list[str]] = None