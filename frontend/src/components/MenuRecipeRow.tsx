import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MenuItem } from '../types/menu'
import { isMealItem, portionsLabel } from '../utils/menu'
import { resolveMediaUrl } from '../utils/recipeDisplay'

interface MenuRecipeRowProps {
  item: MenuItem
  disabled: boolean
  onReplace: (item: MenuItem) => void
  onDelete: (item: MenuItem) => void
  /** Saves a new number of portions; resolves to true on success. */
  onPortionsChange: (item: MenuItem, portions: number) => Promise<boolean>
}

const MIN_PORTIONS = 1
const MAX_PORTIONS = 99

/** A recipe of a menu: thumbnail, title, editable portions, per-meal macros, and replace/delete actions. */
export default function MenuRecipeRow({ item, disabled, onReplace, onDelete, onPortionsChange }: MenuRecipeRowProps) {
  const navigate = useNavigate()
  const { recipe } = item
  // Portions being edited, or null when not editing
  const [draft, setDraft] = useState<number | null>(null)

  async function handleConfirm() {
    if (draft === null) return
    if (draft === item.portions || await onPortionsChange(item, draft)) setDraft(null)
  }

  return (
    <li className="menu-recipe">
      {recipe?.thumbnail_url ? (
        <img
          className="menu-recipe__thumb"
          src={resolveMediaUrl(recipe.thumbnail_url)}
          alt={recipe.title}
          loading="lazy"
        />
      ) : (
        <div className="menu-recipe__thumb menu-recipe__thumb--placeholder">🍽️</div>
      )}

      <div className="menu-recipe__body">
        {recipe ? (
          <button className="menu-recipe__title" onClick={() => navigate(`/recipes/${recipe.id}`)}>
            {recipe.title}
          </button>
        ) : (
          <div className="menu-recipe__title menu-recipe__title--missing">Recette supprimée</div>
        )}
        <div className="menu-recipe__meta">
          {draft === null ? (
            <button
              className="menu-recipe__meals"
              onClick={() => setDraft(item.portions)}
              disabled={disabled || !recipe}
              title="Modifier la quantité"
            >
              {portionsLabel(item)} <span className="menu-recipe__edit-icon">✎</span>
            </button>
          ) : (
            <span className="menu-recipe__stepper">
              <button
                className="menu-recipe__stepper-btn"
                onClick={() => setDraft(Math.max(MIN_PORTIONS, draft - 1))}
                disabled={disabled || draft <= MIN_PORTIONS}
                aria-label="Une portion de moins"
              >
                −
              </button>
              <span className="menu-recipe__stepper-value">{portionsLabel({ ...item, portions: draft })}</span>
              <button
                className="menu-recipe__stepper-btn"
                onClick={() => setDraft(Math.min(MAX_PORTIONS, draft + 1))}
                disabled={disabled || draft >= MAX_PORTIONS}
                aria-label="Une portion de plus"
              >
                +
              </button>
              <button
                className="menu-recipe__stepper-btn menu-recipe__stepper-btn--confirm"
                onClick={handleConfirm}
                disabled={disabled}
                aria-label="Valider la quantité"
              >
                ✓
              </button>
              <button
                className="menu-recipe__stepper-btn"
                onClick={() => setDraft(null)}
                disabled={disabled}
                aria-label="Annuler"
              >
                ×
              </button>
            </span>
          )}
          {recipe?.calories != null && (
            <span className="menu-recipe__macros">
              {Math.round(recipe.calories)} kcal
              {recipe.proteins_g != null && ` · ${Math.round(recipe.proteins_g)} g prot.`}
              {isMealItem(item) ? ' / repas' : ' / portion'}
            </span>
          )}
        </div>
      </div>

      <div className="menu-recipe__actions">
        <button
          className="menu-recipe__action-btn"
          onClick={() => onReplace(item)}
          disabled={disabled}
          title="Remplacer"
          aria-label="Remplacer la recette"
        >
          ↻
        </button>
        <button
          className="menu-recipe__action-btn menu-recipe__action-btn--danger"
          onClick={() => onDelete(item)}
          disabled={disabled}
          title="Supprimer"
          aria-label="Supprimer la recette du menu"
        >
          ×
        </button>
      </div>
    </li>
  )
}
