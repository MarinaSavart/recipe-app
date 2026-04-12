import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MacroBox from '../components/MacroBox'
import { getRecipe, deleteRecipe } from '../services/api'
import type { Recipe } from '../types/recipe'

function platformLabel(platform: string | null): string {
  if (platform === 'instagram') return '📸 Instagram'
  if (platform === 'tiktok') return '🎵 TikTok'
  if (platform === 'manual') return '✍️ Manuel'
  return platform ?? ''
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [portions, setPortions] = useState<number>(1)
  const API = import.meta.env.VITE_API_URL

  useEffect(() => {
    if (!id) return
    getRecipe(Number(id))
      .then((data) => {
        setRecipe(data)
        setPortions(data.servings ?? 1)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!recipe) return
    if (!confirm(`Supprimer "${recipe.title}" ?`)) return
    setDeleting(true)
    try {
      await deleteRecipe(recipe.id)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
      setDeleting(false)
    }
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

  if (!recipe) return null

  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)

  function formatQty(qty: string | null, multiplier: number): string | null {
    if (!qty) return null
    const num = parseFloat(qty)
    if (isNaN(num)) return qty
    const result = num * multiplier
    // Arrondi à l'entier le plus proche pour les valeurs proches d'un entier (±0.05)
    const rounded = Math.abs(result - Math.round(result)) < 0.05
      ? Math.round(result)
      : parseFloat(result.toFixed(1))
    return rounded.toString()
  }


  return (
    <div className="detail">

      {/* Retour */}
      <button className="detail__back" onClick={() => navigate('/')}>
        ← Retour aux recettes
      </button>

      {/* Thumbnail */}
      {recipe.thumbnail_url ? (
        <img
          className="detail__thumb"
          src={recipe.thumbnail_url.startsWith('/uploads')
            ? `${API}${recipe.thumbnail_url}`
            : recipe.thumbnail_url
          }
          alt={recipe.title}
        />
      ) : (
        <div className="detail__thumb--placeholder">🍽️</div>
      )}

      {/* Header */}
      {recipe.source_platform && (
        <div className="detail__platform">{platformLabel(recipe.source_platform)}</div>
      )}
      <h1 className="detail__title">{recipe.title}</h1>
      {recipe.source_author && (
        <div className="detail__author">@{recipe.source_author}</div>
      )}
      {recipe.source_url && (
        <a className="detail__source" href={recipe.source_url} target="_blank" rel="noreferrer">
          ↗ Voir la vidéo originale
        </a>
      )}

      {/* Actions */}
      <div className="detail__actions">
        <button
          className="btn-ghost"
          onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
        >
          ✏️ Modifier
        </button>
        <button
          className="btn-ghost btn-ghost--danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? '⏳ Suppression…' : '🗑 Supprimer'}
        </button>
      </div>

      {/* Macros */}
      {(recipe.calories || recipe.proteins_g || recipe.carbs_g || recipe.fats_g) && (
        <div className="detail__section">
          <div className="detail__section-title">Macros par portion</div>
          <div className="detail__macros">
            {recipe.calories && <MacroBox value={recipe.calories} label="kcal" />}
            {recipe.proteins_g && <MacroBox value={recipe.proteins_g} label="Prot." unit="g" />}
            {recipe.carbs_g && <MacroBox value={recipe.carbs_g} label="Gluc." unit="g" />}
            {recipe.fats_g && <MacroBox value={recipe.fats_g} label="Lip." unit="g" />}
          </div>
        </div>
      )}

    {/* Sélecteur de portions */}
    {recipe.servings && (
      <div className="detail__section">
        <div className="detail__section-title">Portion{portions > 1 ? 's' : ''}</div>
        <div className="portions-selector">
          <button
            className="portions-selector__btn"
            onClick={() => setPortions(p => Math.max(1, p - 1))}
          >
            -
          </button>
          <span className="portions-selector__value">{portions}</span>
          <button
            className="portions-selector__btn"
            onClick={() => setPortions(p => p + 1)}
          >
            +
          </button>
          {portions !== recipe.servings && (
            <button
              className="portions-selector__reset"
              onClick={() => setPortions(recipe.servings!)}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>
    )}

    {/* Infos temps */}
    {totalTime > 0 && (
      <div className="detail__section">
        <div className="detail__section-title">Infos</div>
        <div className="recipe-card__macros">
          {recipe.prep_time_minutes  && <span className="macro-pill">Prép. <strong>{recipe.prep_time_minutes} min</strong></span>}
          {recipe.cook_time_minutes  && <span className="macro-pill">Cuisson <strong>{recipe.cook_time_minutes} min</strong></span>}
          {totalTime > 0             && <span className="macro-pill">Total <strong>{totalTime} min</strong></span>}
        </div>
      </div>
    )}

      {/* Ingrédients */}
      {recipe.ingredients.length > 0 && (
        <div className="detail__section">
          <div className="detail__section-title">Ingrédients</div>
          {recipe.ingredients.map((ing) => (
            <div key={ing.id} className="ingredient-row">
              <span className="ingredient-row__name">
                {ing.name}
                {ing.notes && (
                  <span className="ingredient-row__notes"> — {ing.notes}</span>
                )}
              </span>
              {(ing.quantity || ing.unit) && (
                <span className="ingredient-row__qty">
                  {[formatQty(ing.quantity, portions), ing.unit].filter(Boolean).join(' ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Étapes */}
      {recipe.steps.length > 0 && (
        <div className="detail__section">
          <div className="detail__section-title">Préparation</div>
          {recipe.steps.map((step, i) => (
            <div key={step.id} className="step-row">
              <div className="step-row__num">{i + 1}</div>
              <div>
                <div className="step-row__content">{step.content}</div>
                {step.duration_minutes && (
                  <div className="step-row__duration">⏱ {step.duration_minutes} min</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="detail__section">
          <div className="detail__section-title">Tags</div>
          <div className="tags-row">
            {recipe.tags.map((tag) => (
              <span key={tag.id} className="tag">{tag.name}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}