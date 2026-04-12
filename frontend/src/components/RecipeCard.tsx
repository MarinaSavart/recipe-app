import { useNavigate } from 'react-router-dom'
import type { RecipeListItem } from '../types/recipe'

interface RecipeCardProps {
  recipe: RecipeListItem
}

function platformLabel(platform: string | null): string {
  if (platform === 'instagram') return '📸 Instagram'
  if (platform === 'tiktok') return '🎵 TikTok'
  if (platform === 'manual') return '✍️ Manuel'
  return platform ?? ''
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const navigate = useNavigate()
  const API = import.meta.env.VITE_API_URL
  
  return (
    <div
      className="recipe-card"
      onClick={() => navigate(`/recipes/${recipe.id}`)}
    >
      {recipe.thumbnail_url ? (
        <img
          className="recipe-card__thumb"
          src={recipe.thumbnail_url.startsWith('/uploads')
            ? `${API}${recipe.thumbnail_url}`
            : recipe.thumbnail_url
          }
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
        </div>
      </div>
    </div>
  )
}