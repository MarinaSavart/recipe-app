from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── Import ─────────────────────────────────────────────────────────────────────

class ImportRequest(BaseModel):
    url: str


class ImportManualRequest(BaseModel):
    description: str
    source_url: Optional[str] = None


# ── Ingredient ─────────────────────────────────────────────────────────────────

class IngredientBase(BaseModel):
    name: str
    quantity: Optional[str] = None  # toujours une string : "600", "1/2"
    unit: Optional[str] = None      # "g", "ml", "cas"...
    notes: Optional[str] = None     # "allégé", "râpé"...
    position: int = 0

class IngredientCreate(IngredientBase):
    pass  # identique à Base pour l'instant, mais séparé pour évoluer facilement

class IngredientOut(IngredientBase):
    id: int
    model_config = {"from_attributes": True}  # permet de lire depuis un objet SQLAlchemy


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
    source_url: Optional[str] = None
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
    # utilisé en interne pour créer une recette (après parsing Claude)
    ingredients: list[IngredientCreate] = []
    steps: list[StepCreate] = []
    tags: list[str] = []
    raw_description: Optional[str] = None

class RecipeOut(RecipeBase):
    # ce que l'API retourne — inclut les relations et les timestamps
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
    # version allégée pour la liste — pas besoin de charger ingrédients/étapes
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
    # tous les champs optionnels — on met à jour seulement ce qui est envoyé
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