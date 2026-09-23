/** The user's personal body/activity metrics, used to estimate their TDEE. */
export interface PersonalMetrics {
  gender: 'homme' | 'femme' | ''
  age: number
  weight: number
  height: number
  bodyFatPercent: number | null
  workActivity: 'sedentaire' | 'leger' | 'actif' | 'tres_actif'
  weeklySessions: number
}

/** The user's daily nutritional targets. */
export interface NutritionalGoals {
  goal: string
  calories: number
  proteinsG: number
  carbsG: number
  fatsG: number
  mealsPerDay: number
}

/** The part of the nutritional goals synced with the backend (the goal preset stays local). */
export type SyncedNutritionalGoals = Omit<NutritionalGoals, 'goal'>

/** Selectable nutritional goal presets, shown as buttons in the profile page. */
export const GOALS = [
  { key: 'maintenance',  label: '⚖️ Maintenance' },
  { key: 'masse',        label: '💪 Prise de masse' },
  { key: 'seche',        label: '🔥 Sèche' },
  { key: 'personnalise', label: '✏️ Personnalisé' },
]

/** Selectable work activity level presets, used to estimate the TDEE multiplier. */
export const WORK_ACTIVITIES = [
  { key: 'sedentaire', label: '🪑 Sédentaire',        desc: 'Bureau, peu de déplacements' },
  { key: 'leger',      label: '🚶 Légèrement actif',  desc: 'Debout une partie de la journée' },
  { key: 'actif',      label: '🏃 Actif',             desc: 'Travail physique modéré' },
  { key: 'tres_actif', label: '⚡ Très actif',        desc: 'Travail physique intense' },
]

/** Default personal metrics used before the user has filled in their profile. */
export const DEFAULT_METRICS: PersonalMetrics = {
  gender: '',
  age: 0,
  weight: 0,
  height: 0,
  bodyFatPercent: null,
  workActivity: 'sedentaire',
  weeklySessions: 3,
}

/** Default nutritional goals used before the user has saved their own. */
export const DEFAULT_GOALS: NutritionalGoals = {
  goal: 'maintenance',
  mealsPerDay: 3,
  calories: 2000,
  proteinsG: 150,
  carbsG: 220,
  fatsG: 65,
}