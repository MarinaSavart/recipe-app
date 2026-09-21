/** Recipe categories available for filtering and categorization. */
export const CATEGORIES = [
  { key: 'breakfast',      label: '🌅 Petit-déjeuner' },
  { key: 'repas',          label: '🍽️ Repas' },
  { key: 'collation',      label: '🍎 Collation' },
  { key: 'dessert',        label: '🍰 Dessert' },
  { key: 'snack',          label: '🥨 Snack' },
  { key: 'boisson',        label: '🥤 Boisson' },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

/** Returns the display label (with emoji) for a category key, or the key itself if unknown. */
export function categoryLabel(category: string | null): string | null {
  if (!category) return null
  return CATEGORIES.find(c => c.key === category)?.label ?? category
}
