import type { RecipeListItem } from './recipe'

/** A recipe of a menu, cooked once and eaten over `portions` meals. */
export interface MenuItem {
  id: number
  portions: number     // number of meals covered by this recipe
  position: number
  recipe: RecipeListItem | null
}

/** A full menu, with its recipes. */
export interface Menu {
  id: number
  name: string
  mealsCount: number   // number of meals asked for at creation
  createdAt: string
  updatedAt: string
  items: MenuItem[]
}

/** Lightweight menu shape — used on the menu list page. */
export interface MenuListItem {
  id: number
  name: string
  mealsCount: number
  recipesCount: number
  createdAt: string
}

/** Parameters of an automatic menu generation. */
export interface MenuGenerateParams {
  name: string
  mealsCount: number
}

/** Nutritional values of a meal (kcal and macros in g). */
export interface MealNutrition {
  calories: number
  proteinsG: number
  carbsG: number
  fatsG: number
}

/** Only recipes of this category can be put in a menu. */
export const MENU_CATEGORY = 'repas'
