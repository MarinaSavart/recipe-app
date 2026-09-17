// Correspond exactement aux schemas Pydantic du backend

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
  proteinsG: number | null
  carbsG: number | null
  fatsG: number | null
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
  proteinsG: number | null
  carbsG: number | null
  fatsG: number | null
  created_at: string
}