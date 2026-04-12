import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import { getRecipes } from '../services/api'
import type { RecipeListItem } from '../types/recipe'

interface RecipeListProps {
  onCountChange: (count: number) => void
}

export default function RecipeList({ onCountChange }: RecipeListProps) {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    getRecipes()
      .then((data) => {
        setRecipes(data)
        onCountChange(data.length)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

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
        <h1 className="page-header__title">Mes <em>recettes</em></h1>
        <p className="page-header__sub">
          Toutes tes recettes importées depuis n'importe quelle plateforme !
        </p>
      </div>

      <div className="recipes-grid">
        {recipes.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">🍳</div>
            <div className="empty__title">Aucune recette pour l'instant</div>
            <div className="empty__sub">
              <button
                className="btn-ghost"
                style={{ marginTop: '16px' }}
                onClick={() => navigate('/import')}
              >
                ⚡ Importer ma première recette
              </button>
            </div>
          </div>
        ) : (
          recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))
        )}
      </div>
    </>
  )
}