import type { Ingredient } from '../types/recipe'

const API_URL = import.meta.env.VITE_API_URL

/** Most portions the recipe page accepts from a link (?portions=), like the menu's portion stepper. */
const MAX_LINKED_PORTIONS = 99

/**
 * Portions requested by a link to a recipe (`?portions=3`, e.g. from a menu), or null
 * when absent or invalid (not a whole number between 1 and MAX_LINKED_PORTIONS).
 */
export function parsePortionsParam(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null
  const portions = Number(value)
  return portions >= 1 && portions <= MAX_LINKED_PORTIONS ? portions : null
}

/**
 * Resolves a media URL returned by the backend into an absolute URL.
 * Relative /uploads paths are prefixed with the API base URL; any other
 * URL (e.g. an external thumbnail) is returned as-is.
 *
 * @param url - The media URL as returned by the API
 * @returns An absolute URL usable directly in an <img src>
 */
export function resolveMediaUrl(url: string): string {
  return url.startsWith('/uploads') ? `${API_URL}${url}` : url
}

/**
 * Formats an ingredient quantity scaled to a chosen number of portions.
 * The base quantity is defined for `servings` portions and is rescaled
 * to `multiplier` portions.
 *
 * @param quantity - The base quantity as a string (may be null or non-numeric)
 * @param multiplier - The number of portions the user wants
 * @param servings - The number of portions the base quantity was defined for
 * @returns The scaled quantity as a string, or null if there's no quantity
 */
export function formatQty(quantity: string | null, multiplier: number, servings: number): string | null {
  if (!quantity) return null
  const num = parseFloat(quantity)
  if (isNaN(num)) return quantity
  const result = (num / servings) * multiplier
  const rounded = Math.abs(result - Math.round(result)) < 0.05
    ? Math.round(result)
    : parseFloat(result.toFixed(1))
  return rounded.toString()
}

/** A sub-section of a recipe's ingredients ("poulet mexicain grillé", "sauce"…). */
export interface IngredientSection {
  key: string
  title: string | null  // null for ingredients without a section
  ingredients: Ingredient[]
}

/**
 * Groups a recipe's ingredients by the sub-section stored in their notes at import,
 * in the recipe's order (sections appear where their first ingredient is).
 * Ingredients without notes form an untitled section.
 */
export function groupIngredientsBySection(ingredients: Ingredient[]): IngredientSection[] {
  const sections = new Map<string, IngredientSection>()
  for (const ingredient of [...ingredients].sort((a, b) => a.position - b.position)) {
    const title = ingredient.notes?.trim() || null
    const key = title?.toLowerCase() ?? ''
    const section = sections.get(key) ?? { key, title, ingredients: [] }
    section.ingredients.push(ingredient)
    sections.set(key, section)
  }
  return [...sections.values()]
}
