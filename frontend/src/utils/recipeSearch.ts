import type { RecipeSearchItem } from '../types/recipe'
import { normalizeText } from './menu'

/** A recipe matching the home page search, with the ingredients that matched (shown on its card). */
export interface RecipeSearchResult {
  recipe: RecipeSearchItem
  matchedIngredients: string[]
}

/** The words of a text, lowercased and without accents ("Bœuf haché" → ["boeuf", "hache"]). */
function wordsOf(text: string): string[] {
  return normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean)
}

/** Whether a searched word starts one of the text's words: "oeuf" finds "œuf" but not "bœuf". */
function startsAWord(textWords: string[], searched: string): boolean {
  return textWords.some(word => word.startsWith(searched))
}

/**
 * Searches recipes by title or ingredient, ignoring case and accents ("creme" finds "crème").
 * Every word of the query must start a word of the title or of an ingredient, so results
 * show up while typing ("poul" finds "poulet") and "poulet riz" finds the recipes having both.
 * An empty query returns every recipe.
 */
export function searchRecipesByTitleOrIngredient(recipes: RecipeSearchItem[], query: string): RecipeSearchResult[] {
  const searched = wordsOf(query)
  if (searched.length === 0) return recipes.map(recipe => ({ recipe, matchedIngredients: [] }))

  const results: RecipeSearchResult[] = []
  for (const recipe of recipes) {
    const titleWords = wordsOf(recipe.title)
    const ingredients = recipe.ingredientNames.map(name => ({ name, words: wordsOf(name), key: normalizeText(name) }))
    // Keyed by normalized name: "bœuf haché" and "boeuf haché" (written / canonical) show once
    const matched = new Map<string, string>()

    const allWordsFound = searched.every(word => {
      const hits = ingredients.filter(ingredient => startsAWord(ingredient.words, word))
      for (const hit of hits) if (!matched.has(hit.key)) matched.set(hit.key, hit.name)
      return startsAWord(titleWords, word) || hits.length > 0
    })
    if (allWordsFound) results.push({ recipe, matchedIngredients: [...matched.values()] })
  }
  return results
}
