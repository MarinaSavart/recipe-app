import type { ShoppingListItem } from '../types/menu'
import { normalizeText } from './menu'

/** A displayed line of the shopping list: one ingredient, all its quantities merged. */
export interface ShoppingRow {
  key: string          // normalized name, stable across refreshes (used for ticking)
  name: string
  quantity: string     // e.g. "3 càc + 1", or "" when there's nothing to measure
  recipes: string[]
}

/** A section of the shopping list: a store aisle, or the cupboard check. */
export interface ShoppingSection {
  key: string
  label: string
  rows: ShoppingRow[]
}

// Store aisles, in display order. Keywords are normalized (lowercase, no accents)
// and matched as whole words, singular or plural.
const AISLES = [
  {
    key: 'produce',
    label: '🥬 Fruits & légumes',
    keywords: [
      'oignon', 'ail', 'echalote', 'tomate', 'carotte', 'courgette', 'poivron', 'patate douce',
      'pomme de terre', 'salade', 'epinard', 'brocoli', 'champignon', 'citron', 'citron vert',
      'peche', 'pomme', 'poire', 'banane', 'fraise', 'framboise', 'myrtille', 'avocat', 'concombre',
      'petits pois', 'haricot', 'basilic', 'persil', 'coriandre', 'menthe', 'ciboulette', 'romarin',
      'gingembre', 'poireau', 'chou', 'aubergine', 'courge', 'butternut', 'mangue', 'ananas', 'orange',
      'cebette', 'ciboule',
    ],
  },
  {
    key: 'meat',
    label: '🥩 Viandes & poissons',
    keywords: [
      'poulet', 'boeuf', 'porc', 'jambon', 'lardon', 'dinde', 'veau', 'agneau', 'saumon', 'thon',
      'cabillaud', 'crevette', 'poisson', 'steak', 'viande', 'chorizo', 'saucisse', 'bacon', 'canard',
    ],
  },
  {
    key: 'dairy',
    label: '🧀 Crèmerie & œufs',
    keywords: [
      'lait', 'creme', 'fromage', 'beurre', 'yaourt', 'skyr', 'oeuf', 'mozzarella', 'parmesan', 'feta',
      'ricotta', 'cottage', 'saint moret', 'mascarpone', 'emmental', 'comte', 'chevre', 'blanc d oeuf',
    ],
  },
  {
    key: 'grocery',
    label: '🥫 Épicerie',
    keywords: [
      'pates', 'rigatoni', 'spaghetti', 'penne', 'tagliatelle', 'riz', 'farine', 'sucre', 'miel', 'huile',
      'vinaigre', 'sauce', 'puree', 'concentre', 'lentille', 'pois chiche', 'quinoa', 'semoule', 'pain',
      'chapelure', 'levure', 'chocolat', 'flocon', 'avoine', 'cacahuete', 'amande', 'noix', 'sirop',
      'bouillon', 'lait de coco', 'soja', 'moutarde', 'ketchup', 'mayonnaise', 'cacao', 'maizena',
      'beurre de cacahuete', 'stevia', 'graine', 'chia',
    ],
  },
  {
    key: 'spices',
    label: '🧂 Épices & condiments',
    keywords: [
      'sel', 'poivre', 'paprika', 'piment', 'cumin', 'curry', 'curcuma', 'cannelle', 'muscade',
      'herbes de provence', 'origan', 'thym', 'laurier', 'en poudre', 'epice', 'vanille', 'masala',
    ],
  },
] as const

// Matching order: most specific first ("ail en poudre" is a spice, "purée de tomates"
// and "lait de coco" are grocery, "crème vinaigre balsamique" is grocery too)
const MATCH_ORDER = ['spices', 'grocery', 'meat', 'dairy', 'produce'] as const

const OTHER_AISLE = { key: 'other', label: '🛒 Autres' }
const CUPBOARD = { key: 'cupboard', label: 'À vérifier dans tes placards' }

// Units measured by weight/volume; any other unit (or none) is counted in pieces
const MEASURED_UNITS = new Set(['g', 'ml'])
const PLURAL_UNITS: Record<string, string> = { 'pièce': 'pièces', 'pincée': 'pincées', 'gousse': 'gousses' }
const SINGULAR_UNITS: Record<string, string> = { tranches: 'tranche', feuilles: 'feuille' }

/** Whether a normalized name contains the keyword as whole words (singular or plural). */
function hasKeyword(name: string, keyword: string): boolean {
  const padded = ` ${name.replace(/[^a-z0-9]+/g, ' ')} `
  return padded.includes(` ${keyword} `) || padded.includes(` ${keyword}s `)
}

/** The store aisle of an ingredient, guessed from its name ("other" when unknown). */
export function aisleOf(name: string): string {
  const normalized = normalizeText(name)
  const match = MATCH_ORDER.find(key =>
    AISLES.find(a => a.key === key)!.keywords.some(kw => hasKeyword(normalized, kw))
  )
  return match ?? OTHER_AISLE.key
}

/** A unit with the right grammatical number: "3 pièces", "1 tranche". */
function unitLabel(unit: string, amount: number): string {
  if (amount > 1) return PLURAL_UNITS[unit] ?? unit
  return SINGULAR_UNITS[unit] ?? unit
}

/**
 * Formats a shopping list quantity: weights/volumes rounded (and shown in kg / l
 * from 1000), countable items rounded up since you can't buy a fraction of an onion.
 *
 * @returns e.g. "1,2 kg", "400 g", "3 pièces", "1", or "" when there's no quantity
 */
export function formatShoppingQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return ''
  const format = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

  if (unit && MEASURED_UNITS.has(unit)) {
    if (quantity >= 1000) return `${format(quantity / 1000)} ${unit === 'g' ? 'kg' : 'l'}`
    return `${Math.round(quantity)} ${unit}`
  }

  // Spoons can be halves; anything else is bought whole
  const rounded = unit === 'càs' || unit === 'càc'
    ? Math.ceil(quantity * 2) / 2
    : Math.ceil(quantity - 1e-9)
  return unit ? `${format(rounded)} ${unitLabel(unit, rounded)}` : format(rounded)
}

/**
 * Turns the API's shopping list into display sections: lines with the same
 * ingredient name are merged ("3 càc + 1"), grouped by store aisle, and
 * ingredients with no quantity at all go last, in a cupboard check section.
 */
export function buildShoppingSections(items: ShoppingListItem[]): ShoppingSection[] {
  const rows = new Map<string, ShoppingRow & { parts: string[] }>()

  for (const item of items) {
    const key = normalizeText(item.name)
    const row = rows.get(key) ?? { key, name: item.name, quantity: '', recipes: [], parts: [] }
    const formatted = formatShoppingQuantity(item.quantity, item.unit)
    for (const part of [formatted, ...item.extras]) {
      if (part && !row.parts.includes(part)) row.parts.push(part)
    }
    for (const recipe of item.recipes) {
      if (!row.recipes.includes(recipe)) row.recipes.push(recipe)
    }
    rows.set(key, row)
  }

  const sections = new Map<string, ShoppingSection>(
    [...AISLES, OTHER_AISLE, CUPBOARD].map(a => [a.key, { key: a.key, label: a.label, rows: [] }])
  )
  for (const { parts, ...row } of rows.values()) {
    const quantity = parts.join(' + ')
    const sectionKey = quantity ? aisleOf(row.name) : CUPBOARD.key
    sections.get(sectionKey)!.rows.push({ ...row, quantity })
  }

  return [...sections.values()]
    .filter(s => s.rows.length > 0)
    .map(s => ({ ...s, rows: s.rows.sort((a, b) => a.name.localeCompare(b.name, 'fr')) }))
}
