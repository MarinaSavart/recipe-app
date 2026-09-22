import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import { getRecipes } from '../services/api'
import type { RecipeListItem } from '../types/recipe'
import { CATEGORIES, type CategoryKey } from '../utils/categories'

interface RecipeListProps {
  onCountChange: (count: number) => void
}

/** Displays all recipes visible to the current user as a grid of cards, filterable by category. */
export default function RecipeList({ onCountChange }: RecipeListProps) {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getRecipes(activeCategory ?? undefined)
      .then((data) => {
        setRecipes(data)
        onCountChange(data.length)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeCategory])

  /** Toggles a recipe's liked state in the local list. */
  function handleLikeToggle(id: number) {
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, isLiked: !r.isLiked } : r))
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">Toutes les <em>recettes</em></h1>
        <p className="page-header__sub">
          Toutes tes recettes importées depuis n'importe quelle plateforme !
        </p>
      </div>

      <div className="category-filters">
        <button
          className={`category-filters__btn ${activeCategory === null ? 'category-filters__btn--active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >
          Toutes
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`category-filters__btn ${activeCategory === c.key ? 'category-filters__btn--active' : ''}`}
            onClick={() => setActiveCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">
          <div className="empty__icon">⏳</div>
          <div className="empty__title">Chargement…</div>
        </div>
      ) : error ? (
        <div className="empty">
          <div className="empty__icon">⚠️</div>
          <div className="empty__title">Erreur</div>
          <div className="empty__sub">{error}</div>
        </div>
      ) : (
        <div className="recipes-grid">
          {recipes.length === 0 ? (
            <div className="empty">
              <div className="empty__icon">🍳</div>
              <div className="empty__title">Aucune recette pour l'instant</div>
              <div className="empty__sub">
                <button
                  className="btn-ghost empty__cta"
                  onClick={() => navigate('/import')}
                >
                  ⚡ Importer ma première recette
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
      )}
    </>
  )
}