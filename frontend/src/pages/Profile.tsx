import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRecipes } from '../services/api'
import { calculateTDEE, calculateMacros } from '../utils/nutritionCalc'
import { resolveMediaUrl } from '../utils/recipeDisplay'
import ProfileHeader from '../components/ProfileHeader'
import MetricsSection from '../components/MetricsSection'
import GoalsSection from '../components/GoalsSection'
import type { RecipeListItem } from '../types/recipe'
import { DEFAULT_GOALS, DEFAULT_METRICS, type NutritionalGoals, type PersonalMetrics } from '../types/profil'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [savedMetrics, setSavedMetrics] = useState(false)
  const [savedGoals, setSavedGoals] = useState(false)

  const [metrics, setMetrics] = useState<PersonalMetrics>(() => {
    const stored = localStorage.getItem('personal_metrics')
    if (!stored) return DEFAULT_METRICS

    try {
      const parsed = JSON.parse(stored)

      // Migration : ancien format → nouveau format
      return {
        gender: parsed.gender ?? parsed.sexe ?? '',
        age: parsed.age ?? 0,
        weight: parsed.weight ?? parsed.poids ?? 0,
        height: parsed.height ?? parsed.taille ?? 0,
        bodyFatPercent: parsed.bodyFatPercent ?? parsed.masse_grasse ?? null,
        workActivity: parsed.workActivity ?? parsed.workactivity ?? parsed.activite_pro ?? 'sedentaire',
        weeklySessions: parsed.weeklySessions ?? parsed.weeklysessions ?? parsed.seances_sport ?? 3,  // ← le fix du NaN
      }
    } catch {
      return DEFAULT_METRICS
    }
  })

  const [goals, setGoals] = useState<NutritionalGoals>(() => {
    const stored = localStorage.getItem('nutritional_goals')
    if (!stored) return DEFAULT_GOALS

    try {
      const parsed = JSON.parse(stored)

      // Migration : ancien format → nouveau format
      return {
        goal: parsed.goal ?? parsed.regime ?? 'maintenance',
        mealsPerDay: parsed.mealsPerDay ?? parsed.meals_per_day ?? 3,
        calories: parsed.calories ?? 2000,
        proteinsG: parsed.proteinsG ?? parsed.proteins_g ?? 150,
        carbsG: parsed.carbsG ?? parsed.carbs_g ?? 220,
        fatsG: parsed.fatsG ?? parsed.fats_g ?? 65,
      }
    } catch {
      return DEFAULT_GOALS
    }
  })

  useEffect(() => {
    getRecipes().then(setRecipes).catch(console.error)
  }, [])

  const tdee = calculateTDEE(metrics)

  function handleMetricsChange(nextMetrics: PersonalMetrics) {
    setMetrics(nextMetrics)

    if (goals.goal === 'personnalise') return
    const nextTdee = calculateTDEE(nextMetrics)
    if (!nextTdee || !nextMetrics.weight) return

    const macros = calculateMacros(nextTdee, goals.goal, nextMetrics.weight)
    setGoals(g => ({ ...g, ...macros }))
  }

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