import { useNavigate } from 'react-router-dom'
import type { MenuItem } from '../types/menu'
import { isMealItem, portionsLabel } from '../utils/menu'
import { resolveMediaUrl } from '../utils/recipeDisplay'

interface MenuRecipeRowProps {
  item: MenuItem
  disabled: boolean
  onReplace: (item: MenuItem) => void
  onDelete: (item: MenuItem) => void
}

/** A recipe of a menu: thumbnail, title, meals covered, per-meal macros, and replace/delete actions. */
export default function MenuRecipeRow({ item, disabled, onReplace, onDelete }: MenuRecipeRowProps) {
  const navigate = useNavigate()
  const { recipe } = item

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
          <span className="menu-recipe__meals">{portionsLabel(item)}</span>
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
