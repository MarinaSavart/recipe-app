import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRecipes } from '../services/api'
import { calculateTDEE, calculateMacros } from '../utils/nutritionCalc'
import ProfileHeader from '../components/ProfileHeader'
import MetricsSection from '../components/MetricsSection'
import GoalsSection from '../components/GoalsSection'
import type { RecipeListItem } from '../types/recipe'
import { DEFAULT_GOALS, DEFAULT_METRICS, type NutritionalGoals, type PersonalMetrics } from '../types/profil'

const API = import.meta.env.VITE_API_URL

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [savedMetrics, setSavedMetrics] = useState(false)
  const [savedGoals, setSavedGoals] = useState(false)

  const [metrics, setMetrics] = useState<PersonalMetrics>(() => {
    const stored = localStorage.getItem('personal_metrics')
    return stored ? JSON.parse(stored) : DEFAULT_METRICS
  })

  const [goals, setGoals] = useState<NutritionalGoals>(() => {
    const stored = localStorage.getItem('nutritional_goals')
    return stored ? JSON.parse(stored) : DEFAULT_GOALS
  })

  useEffect(() => {
    getRecipes().then(setRecipes).catch(console.error)
  }, [])

  // Recalcul auto quand métriques ou régime changent
  useEffect(() => {
    if (goals.goal === 'personnalise') return
    const tdee = calculateTDEE(metrics)
    if (!tdee || !metrics.weight) return
    const macros = calculateMacros(tdee, goals.goal, metrics.weight)
    setGoals(g => ({ ...g, ...macros }))
  }, [metrics, goals.goal])

  const tdee = calculateTDEE(metrics)

  function handleRecalculate() {
    if (!tdee || !metrics.weight) return
    const macros = calculateMacros(tdee, goals.goal, metrics.weight)
    setGoals(g => ({ ...g, ...macros }))
  }

  function handleSaveMetrics() {
    localStorage.setItem('personal_metrics', JSON.stringify(metrics))
    setSavedMetrics(true)
    setTimeout(() => setSavedMetrics(false), 2000)
  }

  function handleSaveGoals() {
    localStorage.setItem('nutritional_goals', JSON.stringify(goals))
    setSavedGoals(true)
    setTimeout(() => setSavedGoals(false), 2000)
  }

  return (
    <div className="profile">
      <ProfileHeader
        name={user?.name ?? null}
        email={user?.email ?? ''}
        avatarUrl={user?.avatar_url ?? null}
      />

      <MetricsSection
        metrics={metrics}
        onChange={setMetrics}
        tdee={tdee}
        onRecalculate={handleRecalculate}
        isPersonnalise={goals.goal === 'personnalise'}
        saved={savedMetrics}
        onSave={handleSaveMetrics}
      />

      <GoalsSection
        goals={goals}
        onChange={setGoals}
        saved={savedGoals}
        onSave={handleSaveGoals}
      />

      {/* Carousel — Recettes */}
      <div className="profile__section">
        <div className="profile__section-title">Mes recettes importées</div>
        {recipes.length === 0 ? (
          <div className="profile__empty-carousel">Aucune recette pour l'instant.</div>
        ) : (
          <div className="profile__carousel">
            {recipes.map(r => (
              <div
                key={r.id}
                className="profile__carousel-card"
                onClick={() => navigate(`/recipes/${r.id}`)}
              >
                {r.thumbnail_url ? (
                  <img
                    src={
                      r.thumbnail_url.startsWith('/uploads')
                        ? `${API}${r.thumbnail_url}`
                        : r.thumbnail_url
                    }
                    alt={r.title}
                  />
                ) : (
                  <div className="profile__carousel-card-placeholder">🍽️</div>
                )}
                <div className="profile__carousel-card-body">
                  <div className="profile__carousel-card-title">{r.title}</div>
                  {r.calories && (
                    <div className="profile__carousel-card-meta">{r.calories} kcal / portion</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carousel — Favoris */}
      <div className="profile__section">
        <div className="profile__section-title">Mes favoris</div>
        <div className="profile__empty-carousel">
          🚀 Fonctionnalité à venir — tu pourras liker tes recettes préférées.
        </div>
      </div>
    </div>
  )
}