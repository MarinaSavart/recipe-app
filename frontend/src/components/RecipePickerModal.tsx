import { useState } from 'react'
import type { RecipeListItem } from '../types/recipe'
import { CATEGORIES } from '../utils/categories'
import { searchRecipes } from '../utils/menu'
import { resolveMediaUrl } from '../utils/recipeDisplay'

interface RecipePickerModalProps {
  title: string
  recipes: RecipeListItem[]
  onSelect: (recipe: RecipeListItem) => void
  onClose: () => void
  busy?: boolean
  /** Category preselected in the filter (e.g. the replaced recipe's), or null for all. */
  initialCategory?: string | null
}

/** Modal to pick a recipe: text search, category filter and a scrollable list with thumbnails, portions and calories. */
export default function RecipePickerModal({ title, recipes, onSelect, onClose, busy = false, initialCategory = null }: RecipePickerModalProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(initialCategory)

  const filtered = searchRecipes(recipes, query, category)

  return (
    <div className="recipe-picker" onClick={onClose}>
      <div
        className="recipe-picker__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="recipe-picker__header">
          <h2 className="recipe-picker__title">{title}</h2>
          <button className="recipe-picker__close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="recipe-picker__search">
          <input
            className="recipe-picker__input"
            type="search"
            placeholder="Rechercher une recette…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className="recipe-picker__categories">
            <button
              className={`recipe-picker__category ${category === null ? 'recipe-picker__category--active' : ''}`}
              onClick={() => setCategory(null)}
            >
              Toutes
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                className={`recipe-picker__category ${category === c.key ? 'recipe-picker__category--active' : ''}`}
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="recipe-picker__list">
          {filtered.length === 0 ? (
            <div className="recipe-picker__empty">Aucune recette trouvée.</div>
          ) : (
            filtered.map(r => (
              <button
                key={r.id}
                className="recipe-picker__item"
                onClick={() => onSelect(r)}
                disabled={busy}
              >
                {r.thumbnail_url ? (
                  <img className="recipe-picker__item-thumb" src={resolveMediaUrl(r.thumbnail_url)} alt="" loading="lazy" />
                ) : (
                  <div className="recipe-picker__item-thumb recipe-picker__item-thumb--placeholder">🍽️</div>
                )}
                <span className="recipe-picker__item-title">{r.title}</span>
                <span className="recipe-picker__item-macros">
                  {r.servings ?? 1} portion{(r.servings ?? 1) > 1 ? 's' : ''}
                  {r.calories != null && ` · ${Math.round(r.calories)} kcal`}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
