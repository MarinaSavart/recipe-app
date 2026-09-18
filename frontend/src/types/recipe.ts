// Correspond exactement aux schemas Pydantic du backend
// Le mélange snake_case / camelCase ci-dessous est volontaire : ces interfaces
// représentent le JSON brut échangé avec l'API (donc calqué sur les schémas
// Pydantic), pas des objets internes au frontend.

export interface Ingredient {
    id: number;
    name: string;
    quantity: string | null;
    unit: string | null;
    notes: string | null;
    position: number;
}

export interface Step {
    id: number;
    content: string;
    position: number;
    duration_minutes: number | null;
}

export interface Tag {
    id: number;
    name: string;
}

// Version complète — utilisée sur la page détail
export interface Recipe {
  id: number
  title: string
  description: string | null
  source_url: string | null
  source_platform: string | null
  source_author: string | null
  thumbnail_url: string | null
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
  tags: Tag[]
  created_at: string
  updated_at: string
}

// Version allégée — utilisée sur la page liste (RecipeListItem du backend)
export interface RecipeListItem {
  id: number
  title: string
  source_platform: string | null
  source_author: string | null
  thumbnail_url: string | null
  servings: number | null
  calories: number | null
  proteins_g: number | null
  carbs_g: number | null
  fats_g: number | null
  isLiked: boolean
  likesCount: number
  created_at: string
}

// Payload PATCH /recipes/:id — mêmes clés que Recipe, toutes optionnelles
export interface UpdateRecipePayload {
  title: string
  description: string | null
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  calories: number | null
  proteins_g: number | null
  carbs_g: number | null
  fats_g: number | null
  ingredients: Omit<Ingredient, 'id'>[]
  steps: Omit<Step, 'id'>[]
  tags: string[]
}