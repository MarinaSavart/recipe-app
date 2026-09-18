import { useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RecipeListItem } from '../types/recipe'
import { likeRecipe, unlikeRecipe } from '../services/api'
import { platformLabel, resolveMediaUrl } from '../utils/recipeDisplay'

interface RecipeCardProps {
  recipe: RecipeListItem
  isLiked: boolean
  onLikeToggle: (id: number) => void
}

/** Clickable recipe preview card with a thumbnail, macros, and a like toggle. */
export default function RecipeCard({ recipe, isLiked, onLikeToggle }: RecipeCardProps) {
  const navigate = useNavigate()
  const [liked, setLiked] = useState(isLiked)

  /** Toggles the like state optimistically, reverting on failure. */
  function handleLikeClick(e: MouseEvent) {
    e.stopPropagation()
    const wasLiked = liked
    setLiked(!wasLiked)
    onLikeToggle(recipe.id)

    const request = wasLiked ? unlikeRecipe(recipe.id) : likeRecipe(recipe.id)
    request.catch(() => setLiked(wasLiked))
  }

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
          {recipe.proteins_g && (
            <span className="macro-pill">
              <strong>{Math.round(recipe.proteins_g)}</strong> prot.
            </span>
          )}
          {recipe.carbs_g && (
            <span className="macro-pill">
              <strong>{Math.round(recipe.carbs_g)}</strong> gluc.
            </span>
          )}
          {recipe.fats_g && (
            <span className="macro-pill">
              <strong>{Math.round(recipe.fats_g)}</strong> lip.
            </span>
          )}
          <button
            className="recipe-card__like-btn"
            onClick={handleLikeClick}
            aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {liked ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
    </div>
  )
}
