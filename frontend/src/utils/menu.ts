import type { NutritionalGoals } from '../types/profil'
import type { RecipeListItem } from '../types/recipe'
import { MENU_CATEGORY, type MealNutrition, type MenuItem } from '../types/menu'
import { CATEGORIES } from './categories'

/** Accepted gap between a value and its target (±15%). */
export const GOAL_TOLERANCE = 0.15

/** Whether an item is a main meal (as opposed to an extra: dessert, snack, drink…). */
export function isMealItem(item: MenuItem): boolean {
  return item.recipe?.category === MENU_CATEGORY
}

/** Number of meals covered by the menu's main-meal recipes (extras don't count as meals). */
export function totalMeals(items: MenuItem[]): number {
  return items.filter(isMealItem).reduce((sum, item) => sum + item.portions, 0)
}

/** Label of an item's portions: "3 repas" for main meals, "2 portions" for extras. */
export function portionsLabel(item: MenuItem): string {
  if (isMealItem(item)) return `${item.portions} repas`
  return `${item.portions} portion${item.portions > 1 ? 's' : ''}`
}

/** A section of the menu list: the items of one recipe category. */
export interface MenuItemGroup {
  key: string
  label: string
  items: MenuItem[]
}

/**
 * Groups the menu's items by recipe category, in the app's category order,
 * with uncategorized items (or deleted recipes) last under "Autres".
 */
export function groupByCategory(items: MenuItem[]): MenuItemGroup[] {
  const groups: MenuItemGroup[] = CATEGORIES.map(c => ({
    key: c.key,
    label: c.label,
    items: items.filter(i => i.recipe?.category === c.key),
  }))
  const known = new Set<string>(CATEGORIES.map(c => c.key))
  groups.push({
    key: 'other',
    label: '🍴 Autres',
    items: items.filter(i => !i.recipe?.category || !known.has(i.recipe.category)),
  })
  return groups.filter(g => g.items.length > 0)
}

/**
 * Average nutrition per meal over the whole menu: everything eaten (main meals
 * and extras, per-portion macros × portions) divided by the number of meals.
 * Missing macros count as 0.
 *
 * @returns The average per meal, or null if the menu covers no meal
 */
export function averagePerMeal(items: MenuItem[]): MealNutrition | null {
  const meals = totalMeals(items)
  if (meals === 0) return null

  const sum = { calories: 0, proteinsG: 0, carbsG: 0, fatsG: 0 }
  for (const { recipe, portions } of items) {
    sum.calories += (recipe?.calories ?? 0) * portions
    sum.proteinsG += (recipe?.proteins_g ?? 0) * portions
    sum.carbsG += (recipe?.carbs_g ?? 0) * portions
    sum.fatsG += (recipe?.fats_g ?? 0) * portions
  }

  return {
    calories: sum.calories / meals,
    proteinsG: sum.proteinsG / meals,
    carbsG: sum.carbsG / meals,
    fatsG: sum.fatsG / meals,
  }
}

/** Targets for a single meal: the daily goals divided by the meals per day. */
export function perMealTargets(goals: NutritionalGoals): MealNutrition {
  const meals = Math.max(1, goals.mealsPerDay)
  return {
    calories: goals.calories / meals,
    proteinsG: goals.proteinsG / meals,
    carbsG: goals.carbsG / meals,
    fatsG: goals.fatsG / meals,
  }
}

/** Whether a value is within ±tolerance of its target (always true when there's no target). */
export function isWithinTolerance(value: number, target: number, tolerance = GOAL_TOLERANCE): boolean {
  if (target <= 0) return true
  return Math.abs(value - target) / target <= tolerance
}

/** Lowercases and strips accents (and the œ ligature), for accent-insensitive comparisons. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').toLowerCase()
}

/**
 * Filters recipes by a case- and accent-insensitive title search and an optional category.
 *
 * @param recipes - The recipes to filter
 * @param query - Free text searched in the title
 * @param category - Category key, or null for all categories
 */
export function searchRecipes(recipes: RecipeListItem[], query: string, category: string | null): RecipeListItem[] {
  const q = normalizeText(query.trim())
  return recipes.filter(r =>
    (category === null || r.category === category) &&
    (q === '' || normalizeText(r.title).includes(q))
  )
}

/** Formats an ISO date as a short French date, e.g. "23 sept. 2026". */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Suggested name for a new menu, based on the Monday of the given date's week,
 * e.g. "Semaine du 21 sept.".
 */
export function defaultMenuName(today: Date = new Date()): string {
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return `Semaine du ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}
