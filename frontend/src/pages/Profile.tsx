import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MacroBox from '../components/MacroBox'
import { getRecipes } from '../services/api'
import type { RecipeListItem } from '../types/recipe'

const API = import.meta.env.VITE_API_URL

// ── Types ──────────────────────────────────────────────────────────────────────
interface PersonalMetrics {
  sexe: 'homme' | 'femme' | ''
  age: number
  poids: number       // kg
  taille: number      // cm
  masse_grasse: number | null  // % optionnel
  activite_pro: 'sedentaire' | 'leger' | 'actif' | 'tres_actif'
  seances_sport: number
}

interface NutritionalGoals {
  regime: string
  calories: number
  proteins_g: number
  carbs_g: number
  fats_g: number
  meals_per_day: number
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const REGIMES = [
  { key: 'maintenance',  label: '⚖️ Maintenance' },
  { key: 'masse',        label: '💪 Prise de masse' },
  { key: 'seche',        label: '🔥 Sèche' },
  { key: 'personnalise', label: '✏️ Personnalisé' },
]

const ACTIVITE_PRO = [
  { key: 'sedentaire',  label: '🪑 Sédentaire', desc: 'Bureau, peu de déplacements' },
  { key: 'leger',       label: '🚶 Légèrement actif', desc: 'Debout une partie de la journée' },
  { key: 'actif',       label: '🏃 Actif', desc: 'Travail physique modéré' },
  { key: 'tres_actif',  label: '⚡ Très actif', desc: 'Travail physique intense' },
]

// Multiplicateurs TDEE selon activité pro + sport
function getActivityMultiplier(activite_pro: string, seances_sport: number): number {
  
  const base: Record<string, number> = {
    sedentaire: 1.2,
    leger:      1.375,
    actif:      1.55,
    tres_actif: 1.725,
  }
  const sportBonus = seances_sport * 0.06
  const maxSportBonus = 0.35 
  return (base[activite_pro] ?? 1.2) + Math.min(sportBonus, maxSportBonus)
}

// ── Calcul TDEE ────────────────────────────────────────────────────────────────
function calculateTDEE(metrics: PersonalMetrics): number | null {
  if (!metrics.sexe || !metrics.age || !metrics.poids || !metrics.taille) return null

  let bmr: number

  if (metrics.masse_grasse !== null) {
    // Katch-McArdle : BMR = 370 + (21.6 × masse maigre en kg)
    const lbm = metrics.poids * (1 - metrics.masse_grasse / 100)
    bmr = 370 + 21.6 * lbm
  } else {
    // Mifflin-St Jeor
    if (metrics.sexe === 'homme') {
      bmr = 10 * metrics.poids + 6.25 * metrics.taille - 5 * metrics.age + 5
    } else {
      bmr = (10 * metrics.poids) + (6.25 * metrics.taille) - (5 * metrics.age) - 161
    }
  }

  const multiplier = getActivityMultiplier(metrics.activite_pro, metrics.seances_sport)
  return Math.round(bmr * multiplier)
}

// ── Calcul macros selon objectif ───────────────────────────────────────────────
function calculateMacros(tdee: number, regime: string, poids: number): Omit<NutritionalGoals, 'regime' | 'meals_per_day'> {
  let calories: number
  let proteins_g: number
  let carbs_g: number
  let fats_g: number

  switch (regime) {

    case 'maintenance':
      calories   = tdee
      proteins_g = Math.round(poids * 1.8)    // milieu de fourchette 1.6-2.2g/kg
      carbs_g    = Math.round(poids * 4.0)    // 3-5g/kg → 4 maintenance
      fats_g     = Math.round((calories - proteins_g * 4 - carbs_g * 4) / 9)
      // Sécurité lipides min 1g/kg
      if (fats_g < poids * 1.0) {
        fats_g  = Math.round(poids * 1.0)
        carbs_g = Math.round((calories - proteins_g * 4 - fats_g * 9) / 4)
      }
      break

    case 'seche':
      calories   = Math.max(1200, Math.round(tdee * 0.82))  // -18% max
      proteins_g = Math.round(poids * 1.8)    // 1.6-2.2g/kg
      carbs_g    = Math.round(poids * 3.0)    // min 3g/kg selon le livre
      fats_g     = Math.round((calories - proteins_g * 4 - carbs_g * 4) / 9)
      // Sécurité lipides min 0.8g/kg
      if (fats_g < poids * 0.8) {
        fats_g  = Math.round(poids * 0.8)
        carbs_g = Math.round((calories - proteins_g * 4 - fats_g * 9) / 4)
      }
      break

    case 'masse':
      calories   = tdee + 300                 // surplus modéré +300 kcal
      proteins_g = Math.round(poids * 2.0)    // 1.6-2.2g/kg → 2.0 pour la synthèse
      carbs_g    = Math.round(poids * 5.0)    // 4-6g/kg → 5 pour l'énergie et la synthèse
      fats_g     = Math.round((calories - proteins_g * 4 - carbs_g * 4) / 9)
      // Sécurité lipides min 1g/kg, max 30% des calories
      if (fats_g < poids * 1.0) {
        fats_g  = Math.round(poids * 1.0)
        carbs_g = Math.round((calories - proteins_g * 4 - fats_g * 9) / 4)
      }
      if (fats_g > calories * 0.30 / 9) {
        fats_g  = Math.round(calories * 0.30 / 9)
        carbs_g = Math.round((calories - proteins_g * 4 - fats_g * 9) / 4)
      }
      break

    default: // personnalise
      calories   = tdee
      proteins_g = Math.round(poids * 1.8)
      carbs_g    = Math.round(poids * 4.0)
      fats_g     = Math.round((calories - proteins_g * 4 - carbs_g * 4) / 9)
      if (fats_g < poids * 1.0) {
        fats_g  = Math.round(poids * 1.0)
        carbs_g = Math.round((calories - proteins_g * 4 - fats_g * 9) / 4)
      }
  }

  return {
    calories,
    proteins_g: Math.max(0, proteins_g),
    carbs_g:    Math.max(0, carbs_g),
    fats_g:     Math.max(0, fats_g),
  }
}

// ── Composant ──────────────────────────────────────────────────────────────────
export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [saved, setSaved] = useState(false)
  const [showMassGrasse, setShowMassGrasse] = useState(() => {
    const stored = localStorage.getItem('personal_metrics')
    return stored ? JSON.parse(stored).masse_grasse !== null : false
  })

  const [metrics, setMetrics] = useState<PersonalMetrics>(() => {
    const stored = localStorage.getItem('personal_metrics')
    if (stored) return JSON.parse(stored)
    return {
      sexe: '', age: 0, poids: 0, taille: 0,
      masse_grasse: null, activite_pro: 'sedentaire', seances_sport: 3,
    }
  })

  const [goals, setGoals] = useState<NutritionalGoals>(() => {
    const stored = localStorage.getItem('nutritional_goals')
    if (stored) return JSON.parse(stored)
    return { regime: 'maintenance', meals_per_day: 3, calories: 2000, proteins_g: 150, carbs_g: 220, fats_g: 65 }
  })

  useEffect(() => {
    getRecipes().then(setRecipes).catch(console.error)
  }, [])

  // Recalcule automatiquement quand les métriques ou le régime changent
  useEffect(() => {
    if (goals.regime === 'personnalise') return
    const tdee = calculateTDEE(metrics)
    if (!tdee || !metrics.poids) return
    const macros = calculateMacros(tdee, goals.regime, metrics.poids)
    setGoals(g => ({ ...g, ...macros }))
  }, [metrics, goals.regime])

  function handleRegimeChange(key: string) {
    setGoals(g => ({ ...g, regime: key }))
  }

  function handleSave() {
    localStorage.setItem('personal_metrics', JSON.stringify(metrics))
    localStorage.setItem('nutritional_goals', JSON.stringify(goals))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tdee = calculateTDEE(metrics)
  const perMeal = {
    calories:   Math.round(goals.calories / goals.meals_per_day),
    proteins_g: Math.round(goals.proteins_g / goals.meals_per_day),
    carbs_g:    Math.round(goals.carbs_g / goals.meals_per_day),
    fats_g:     Math.round(goals.fats_g / goals.meals_per_day),
  }

  return (
    <div className="profile">

      {/* Header */}
      <div className="profile__header">
        {user?.avatar_url ? (
          <img className="profile__avatar" src={user.avatar_url} alt={user.name ?? ''} />
        ) : (
          <div className="profile__avatar-placeholder">
            {user?.name?.charAt(0).toUpperCase() ?? '👤'}
          </div>
        )}
        <div className="profile__info">
          <div className="profile__name">{user?.name ?? 'Mon profil'}</div>
          <div className="profile__email">{user?.email}</div>
        </div>
      </div>

      {/* Métriques personnelles */}
      <div className="profile__section">
        <div className="profile__section-title">Mes métriques</div>

        {/* Sexe */}
        <div className="profile__regimes" style={{ marginBottom: '16px' }}>
          {['homme', 'femme'].map(s => (
            <button
              key={s}
              className={`profile__regime-btn ${metrics.sexe === s ? 'profile__regime-btn--active' : ''}`}
              onClick={() => setMetrics(m => ({ ...m, sexe: s as 'homme' | 'femme' }))}
            >
              {s === 'homme' ? '👨 Homme' : '👩 Femme'}
            </button>
          ))}
        </div>

        <div className="profile__goals-grid">
          <div className="profile__goal-field">
            <label>Âge</label>
            <input type="number" placeholder="28" value={metrics.age || ''}
              onChange={e => setMetrics(m => ({ ...m, age: Number(e.target.value) }))} />
          </div>
          <div className="profile__goal-field">
            <label>Poids (kg)</label>
            <input type="number" placeholder="68" value={metrics.poids || ''}
              onChange={e => setMetrics(m => ({ ...m, poids: Number(e.target.value) }))} />
          </div>
          <div className="profile__goal-field">
            <label>Taille (cm)</label>
            <input type="number" placeholder="168" value={metrics.taille || ''}
              onChange={e => setMetrics(m => ({ ...m, taille: Number(e.target.value) }))} />
          </div>
          <div className="profile__goal-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              % Masse grasse
              <button
                onClick={() => {
                  setShowMassGrasse(v => !v)
                  setMetrics(m => ({ ...m, masse_grasse: null }))
                }}
                style={{ fontSize: 11, color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showMassGrasse ? '− Retirer' : '+ Ajouter'}
              </button>
            </label>
            {showMassGrasse ? (
              <input type="number" placeholder="20" value={metrics.masse_grasse ?? ''}
                onChange={e => setMetrics(m => ({ ...m, masse_grasse: Number(e.target.value) || null }))} />
            ) : (
              <input disabled placeholder="Non renseigné"
                style={{ opacity: 0.4, cursor: 'not-allowed' }} />
            )}
          </div>
        </div>

        {/* Activité pro */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: '8px' }}>Activité professionnelle</div>
          <div className="profile__regimes">
            {ACTIVITE_PRO.map(a => (
              <button
                key={a.key}
                className={`profile__regime-btn ${metrics.activite_pro === a.key ? 'profile__regime-btn--active' : ''}`}
                onClick={() => setMetrics(m => ({ ...m, activite_pro: a.key as PersonalMetrics['activite_pro'] }))}
                title={a.desc}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Séances sport */}
        <div className="profile__repas-selector">
          <label>Séances de sport / semaine</label>
          <div className="portions-selector">
            <button className="portions-selector__btn"
              onClick={() => setMetrics(m => ({ ...m, seances_sport: Math.max(0, m.seances_sport - 1) }))}>−</button>
            <span className="portions-selector__value">{metrics.seances_sport}</span>
            <button className="portions-selector__btn"
              onClick={() => setMetrics(m => ({ ...m, seances_sport: Math.min(14, m.seances_sport + 1) }))}>+</button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: '16px', marginTop: '-8px' }}>
          💡 Basé sur une moyenne de 60 min par séance
        </div>

        {/* Bouton calculer */}
        {tdee ? (
          <div style={{
            background: 'var(--surface)', borderRadius: '10px', padding: '12px 16px',
            marginBottom: '16px', fontSize: 13, color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span>
              🔥 TDEE estimé :
              <strong style={{ color: 'var(--amber)', marginLeft: '8px', fontSize: 16 }}>
                {tdee} kcal / jour
              </strong>
              <span style={{ fontSize: 11, marginLeft: '8px' }}>
                {metrics.masse_grasse ? '(Katch-McArdle)' : '(Mifflin-St Jeor)'}
              </span>
            </span>
            <button
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: 13 }}
              onClick={() => {
                if (goals.regime === 'personnalise') return
                const macros = calculateMacros(tdee, goals.regime, metrics.poids)
                setGoals(g => ({ ...g, ...macros }))
              }}
            >
              ↻ Recalculer
            </button>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', borderRadius: '10px', padding: '12px 16px',
            marginBottom: '16px', fontSize: 13, color: 'var(--muted)'
          }}>
            💡 Remplis tes métriques pour obtenir un calcul automatique
          </div>
        )}

        <button
          className="btn-primary profile__save"
          onClick={() => {
            localStorage.setItem('personal_metrics', JSON.stringify(metrics))
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          }}
        >
          {saved ? '✅ Métriques sauvegardées !' : '💾 Sauvegarder mes métriques'}
        </button>

        {/* TDEE calculé */}
        {tdee && (
          <div style={{
            background: 'var(--surface)', borderRadius: '10px', padding: '12px 16px',
            marginBottom: '16px', fontSize: 13, color: 'var(--muted)'
          }}>
            🔥 Dépense énergétique estimée (TDEE) :
            <strong style={{ color: 'var(--amber)', marginLeft: '8px', fontSize: 16 }}>
              {tdee} kcal / jour
            </strong>
            <span style={{ fontSize: 11, marginLeft: '8px' }}>
              {metrics.masse_grasse ? '(Katch-McArdle)' : '(Mifflin-St Jeor)'}
            </span>
          </div>
        )}
      </div>

      {/* Objectifs nutritionnels */}
      <div className="profile__section">
        <div className="profile__section-title">Objectifs nutritionnels</div>

        <div className="profile__regimes">
          {REGIMES.map(r => (
            <button
              key={r.key}
              className={`profile__regime-btn ${goals.regime === r.key ? 'profile__regime-btn--active' : ''}`}
              onClick={() => handleRegimeChange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="profile__goals-grid">
          <div className="profile__goal-field">
            <label>Calories / jour (kcal)</label>
            <input type="number" value={goals.calories}
              onChange={e => setGoals(g => ({ ...g, calories: Number(e.target.value), regime: 'personnalise' }))} />
          </div>
          <div className="profile__goal-field">
            <label>Protéines / jour (g)</label>
            <input type="number" value={goals.proteins_g}
              onChange={e => setGoals(g => ({ ...g, proteins_g: Number(e.target.value), regime: 'personnalise' }))} />
          </div>
          <div className="profile__goal-field">
            <label>Glucides / jour (g)</label>
            <input type="number" value={goals.carbs_g}
              onChange={e => setGoals(g => ({ ...g, carbs_g: Number(e.target.value), regime: 'personnalise' }))} />
          </div>
          <div className="profile__goal-field">
            <label>Lipides / jour (g)</label>
            <input type="number" value={goals.fats_g}
              onChange={e => setGoals(g => ({ ...g, fats_g: Number(e.target.value), regime: 'personnalise' }))} />
          </div>
        </div>

        {/* Nombre de repas */}
        <div className="profile__repas-selector">
          <label>Repas par jour</label>
          <div className="portions-selector">
            <button className="portions-selector__btn"
              onClick={() => setGoals(g => ({ ...g, meals_per_day: Math.max(1, g.meals_per_day - 1) }))}>−</button>
            <span className="portions-selector__value">{goals.meals_per_day}</span>
            <button className="portions-selector__btn"
              onClick={() => setGoals(g => ({ ...g, meals_per_day: Math.min(6, g.meals_per_day + 1) }))}>+</button>
          </div>
        </div>

        {/* Macros par repas */}
        <div className="profile__per-meal">
          <div className="profile__per-meal-title">
            Objectif par repas ({goals.meals_per_day} repas/jour)
          </div>
          <div className="profile__per-meal-macros">
            <MacroBox value={perMeal.calories}   label="kcal" />
            <MacroBox value={perMeal.proteins_g} label="Prot." unit="g" />
            <MacroBox value={perMeal.carbs_g}    label="Gluc." unit="g" />
            <MacroBox value={perMeal.fats_g}     label="Lip."  unit="g" />
          </div>
        </div>

        <button className="btn-primary profile__save" onClick={handleSave}>
          {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder mon profil'}
        </button>
      </div>

      {/* Carousel — Recettes importées */}
      <div className="profile__section">
        <div className="profile__section-title">Mes recettes importées</div>
        {recipes.length === 0 ? (
          <div className="profile__empty-carousel">Aucune recette pour l'instant.</div>
        ) : (
          <div className="profile__carousel">
            {recipes.map(r => (
              <div key={r.id} className="profile__carousel-card" onClick={() => navigate(`/recipes/${r.id}`)}>
                {r.thumbnail_url ? (
                  <img
                    src={r.thumbnail_url.startsWith('/uploads') ? `${API}${r.thumbnail_url}` : r.thumbnail_url}
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

      {/* Carousel — Favoris placeholder */}
      <div className="profile__section">
        <div className="profile__section-title">Mes favoris</div>
        <div className="profile__empty-carousel">
          🚀 Fonctionnalité à venir — tu pourras liker tes recettes préférées.
        </div>
      </div>

    </div>
  )
}