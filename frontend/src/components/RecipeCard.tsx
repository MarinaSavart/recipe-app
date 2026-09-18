import { useNavigate } from 'react-router-dom'
import type { RecipeListItem } from '../types/recipe'
import { platformLabel, resolveMediaUrl } from '../utils/recipeDisplay'

interface RecipeCardProps {
  recipe: RecipeListItem
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const navigate = useNavigate()

  return (
    <div
      className="recipe-card"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
    >
      {recipe.thumbnail_url ? (
        <img
          className="recipe-card__thumb"
          src={resolveMediaUrl(recipe.thumbnail_url)}
          alt={recipe.title}
          loading="lazy"
        />
      ) : (
        <div className="recipe-card__thumb--placeholder">🍽️</div>
      )}

      <div className="recipe-card__body">
        {recipe.source_platform && (
          <div className="recipe-card__platform">
            {platformLabel(recipe.source_platform)}
          </div>
        )}

        <div className="recipe-card__title">{recipe.title}</div>

        {recipe.source_author && (
          <div className="recipe-card__author">@{recipe.source_author}</div>
        )}

        <div className="recipe-card__macros">
          {recipe.calories && (
            <span className="macro-pill">
              <strong>{Math.round(recipe.calories)}</strong> kcal
            </span>
          )}
          {recipe.proteinsG && (
            <span className="macro-pill">
              <strong>{Math.round(recipe.proteinsG)}</strong> prot.
            </span>
          )}
          {recipe.carbsG && (
            <span className="macro-pill">
              <strong>{Math.round(recipe.carbsG)}</strong> gluc.
            </span>
          )}
          {recipe.fatsG && (
            <span className="macro-pill">
              <strong>{Math.round(recipe.fatsG)}</strong> lip.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}