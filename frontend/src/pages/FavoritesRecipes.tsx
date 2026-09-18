import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import { getLikedRecipes } from '../services/api'
import type { RecipeListItem } from '../types/recipe'

export default function FavoritesRecipes() {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    getLikedRecipes()
      .then(setRecipes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleLikeToggle(id: number) {
    setRecipes(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return (
    <div className="empty">
      <div className="empty__icon">⏳</div>
      <div className="empty__title">Chargement…</div>
    </div>
  )

  if (error) return (
    <div className="empty">
      <div className="empty__icon">⚠️</div>
      <div className="empty__title">Erreur</div>
      <div className="empty__sub">{error}</div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">Mes <em>favoris</em></h1>
        <p className="page-header__sub">
          Toutes les recettes que tu as likées.
        </p>
      </div>

      <div className="recipes-grid">
        {recipes.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">🤍</div>
            <div className="empty__title">Aucun favori pour l'instant</div>
            <div className="empty__sub">
              <button
                className="btn-ghost empty__cta"
                onClick={() => navigate('/')}
              >
                📚 Découvrir mes recettes
              </button>
            </div>
          </div>
        ) : (
          recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isLiked={recipe.isLiked}
              onLikeToggle={handleLikeToggle}
            />
          ))
        )}
      </div>
    </>
  )
}
