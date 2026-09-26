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

/** Category of main meals: used by generation and counted in the menu's meals (other categories are extras). */
export const MENU_CATEGORY = 'repas'

/** A line of a menu's shopping list (ingredients merged by name and unit). */
export interface ShoppingListItem {
  name: string
  quantity: number | null  // total for the menu's portions, null if not measurable
  unit: string | null
  aisle: string | null     // store aisle from the ingredients' enrichment (Ciqual / Mistral), null if not enriched
  extras: string[]         // quantities that couldn't be added up, as written
  recipes: string[]        // titles of the recipes that need this ingredient
}
