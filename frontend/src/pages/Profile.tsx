import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyRecipes, getLikedRecipes } from '../services/api'
import { loadGoals, readStoredGoals, saveGoals } from '../services/goals'
import { calculateTDEE, calculateMacros } from '../utils/nutritionCalc'
import { resolveMediaUrl } from '../utils/recipeDisplay'
import ProfileHeader from '../components/ProfileHeader'
import MetricsSection from '../components/MetricsSection'
import GoalsSection from '../components/GoalsSection'
import type { RecipeListItem } from '../types/recipe'
import { DEFAULT_GOALS, DEFAULT_METRICS, type NutritionalGoals, type PersonalMetrics } from '../types/profil'

/** Profile page: personal metrics, nutritional goals, and a recap of the user's recipes/favorites. */
export default function Profile() {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()

  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [likedRecipes, setLikedRecipes] = useState<RecipeListItem[]>([])
  const [savedMetrics, setSavedMetrics] = useState(false)
  const [savedGoals, setSavedGoals] = useState(false)

  const metricsKey = `personal_metrics_${user?.id}`

  const [metrics, setMetrics] = useState<PersonalMetrics>(() => {
    const stored = localStorage.getItem(metricsKey)
    if (!stored) return DEFAULT_METRICS

    try {
      const parsed = JSON.parse(stored)

      // Migration: old format → new format
      return {
        gender: parsed.gender ?? parsed.sexe ?? '',
        age: parsed.age ?? 0,
        weight: parsed.weight ?? parsed.poids ?? 0,
        height: parsed.height ?? parsed.taille ?? 0,
        bodyFatPercent: parsed.bodyFatPercent ?? parsed.masse_grasse ?? null,
        workActivity: parsed.workActivity ?? parsed.workactivity ?? parsed.activite_pro ?? 'sedentaire',
        weeklySessions: parsed.weeklySessions ?? parsed.weeklysessions ?? parsed.seances_sport ?? 3,  // ← the NaN fix
      }
    } catch {
      return DEFAULT_METRICS
    }
  })

  const [goals, setGoals] = useState<NutritionalGoals>(() =>
    (user && readStoredGoals(user.id)) ?? DEFAULT_GOALS
  )

  useEffect(() => {
    getMyRecipes().then(setRecipes).catch(console.error)
    getLikedRecipes().then(setLikedRecipes).catch(console.error)
    if (userId) loadGoals(userId).then(setGoals).catch(console.error)
  }, [userId])

  const tdee = calculateTDEE(metrics)

  /** Updates the metrics and, unless goals are customized, recalculates goals from the new TDEE. */
  function handleMetricsChange(nextMetrics: PersonalMetrics) {
    setMetrics(nextMetrics)

    if (goals.goal === 'personnalise') return
    const nextTdee = calculateTDEE(nextMetrics)
    if (!nextTdee || !nextMetrics.weight) return

    const macros = calculateMacros(nextTdee, goals.goal, nextMetrics.weight)
    setGoals(g => ({ ...g, ...macros }))
  }

  /** Applies a goals change, recomputing macros from the current TDEE unless the goal is customized. */
  function handleGoalsChange(nextGoals: NutritionalGoals) {
    if (nextGoals.goal === 'personnalise') {
      setGoals(nextGoals)
      return
    }

    const nextTdee = calculateTDEE(metrics)
    if (!nextTdee || !metrics.weight) {
      setGoals(nextGoals)
      return
    }

    const macros = calculateMacros(nextTdee, nextGoals.goal, metrics.weight)
    setGoals({ ...nextGoals, ...macros })
  }

  /** Recomputes macro targets from the current TDEE and goal. */
  function handleRecalculate() {
    if (!tdee || !metrics.weight) return
    const macros = calculateMacros(tdee, goals.goal, metrics.weight)
    setGoals(g => ({ ...g, ...macros }))
  }

  /** Persists the metrics to localStorage and briefly shows a saved confirmation. */
  function handleSaveMetrics() {
    localStorage.setItem(metricsKey, JSON.stringify(metrics))
    setSavedMetrics(true)
    setTimeout(() => setSavedMetrics(false), 2000)
  }

  /** Persists the goals to localStorage and the backend, then briefly shows a saved confirmation. */
  function handleSaveGoals() {
    if (!user) return
    saveGoals(user.id, goals)
      .then(() => {
        setSavedGoals(true)
        setTimeout(() => setSavedGoals(false), 2000)
      })
      .catch(console.error)
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
        onChange={handleMetricsChange}
        tdee={tdee}
        onRecalculate={handleRecalculate}
        isPersonnalise={goals.goal === 'personnalise'}
        saved={savedMetrics}
        onSave={handleSaveMetrics}
      />

      <GoalsSection
        goals={goals}
        onChange={handleGoalsChange}
        saved={savedGoals}
        onSave={handleSaveGoals}
      />

      {/* Carousel — Recipes */}
      <div className="profile__section">
        <div className="profile__section-title">Mes recettes importées</div>
        {recipes.length === 0 ? (
          <div className="profile__empty-carousel">Aucune recette pour l'instant.</div>
        ) : (
          <div className="profile__carousel">
            {recipes.slice(0, 5).map(r => (
              <div
                key={r.id}
                className="profile__carousel-card"
                onClick={() => navigate(`/recipes/${r.id}`)}
              >
                {r.thumbnail_url ? (
                  <img
                    src={resolveMediaUrl(r.thumbnail_url)}
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

      {/* Carousel — Favorites */}
      <div className="profile__section">
        <div className="profile__section-title">Mes favoris</div>
        {likedRecipes.length === 0 ? (
          <div className="profile__empty-carousel">Aucun favori pour l'instant.</div>
        ) : (
          <div className="profile__carousel">
            {likedRecipes.slice(0, 5).map(r => (
              <div
                key={r.id}
                className="profile__carousel-card"
                onClick={() => navigate(`/recipes/${r.id}`)}
              >
                {r.thumbnail_url ? (
                  <img
                    src={resolveMediaUrl(r.thumbnail_url)}
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
    </div>
  )
}