// Matches the backend's Pydantic schemas exactly.
// The snake_case / camelCase mix below is intentional: these interfaces
// represent the raw JSON exchanged with the API (so they mirror the
// Pydantic schemas), not internal frontend objects.

/** A food of the ANSES-Ciqual table (linked to an ingredient, or suggested while typing). */
export interface CiqualFood {
    code: number;
    name_fr: string;
    aisle: string;
}

/** A single recipe ingredient, as returned by the API. */
export interface Ingredient {
    id: number;
    name: string;
    quantity: string | null;
    unit: string | null;
    notes: string | null;
    position: number;
    ciqual_food: CiqualFood | null;
}

/** An ingredient as sent when updating a recipe: `ciqual_code` is the (hand-picked or kept) link, null if none. */
export interface IngredientPayload extends Omit<Ingredient, 'id' | 'ciqual_food'> {
    ciqual_code: number | null;
}

/** A single recipe step, as returned by the API. */
export interface Step {
    id: number;
    content: string;
    position: number;
    duration_minutes: number | null;
}

/** Full recipe shape — used on the detail page. */
export interface Recipe {
  id: number
  title: string
  description: string | null
  source_url: string | null
  source_platform: string | null
  source_author: string | null
  thumbnail_url: string | null
  category: string | null
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  calories: number | null
  proteins_g: number | null
  carbs_g: number | null
  fats_g: number | null
  isLiked: boolean
  likesCount: number
  ingredients: Ingredient[]
  steps: Step[]
  created_at: string
  updated_at: string
}

/** Lightweight recipe shape — used on the list page (backend's RecipeListItem). */
export interface RecipeListItem {
  id: number
  title: string
  source_platform: string | null
  source_author: string | null
  thumbnail_url: string | null
  category: string | null
  servings: number | null
  calories: number | null
  proteins_g: number | null
  carbs_g: number | null
  fats_g: number | null
  isLiked: boolean
  likesCount: number
  created_at: string
}

/** PATCH /recipes/:id payload — same keys as Recipe, all optional. */
export interface UpdateRecipePayload {
  title: string
  description: string | null
  category: string | null
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  calories: number | null
  proteins_g: number | null
  carbs_g: number | null
  fats_g: number | null
  ingredients: IngredientPayload[]
  steps: Omit<Step, 'id'>[]
}