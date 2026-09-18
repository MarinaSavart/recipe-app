export interface PersonalMetrics {
  gender: 'homme' | 'femme' | ''
  age: number
  weight: number
  height: number
  bodyFatPercent: number | null
  workActivity: 'sedentaire' | 'leger' | 'actif' | 'tres_actif'
  weeklySessions: number
}

export interface NutritionalGoals {
  goal: string
  calories: number
  proteinsG: number
  carbsG: number
  fatsG: number
  mealsPerDay: number
}

export const GOALS = [
  { key: 'maintenance',  label: '⚖️ Maintenance' },
  { key: 'masse',        label: '💪 Prise de masse' },
  { key: 'seche',        label: '🔥 Sèche' },
  { key: 'personnalise', label: '✏️ Personnalisé' },
]

export const WORK_ACTIVITIES = [
  { key: 'sedentaire', label: '🪑 Sédentaire',        desc: 'Bureau, peu de déplacements' },
  { key: 'leger',      label: '🚶 Légèrement actif',  desc: 'Debout une partie de la journée' },
  { key: 'actif',      label: '🏃 Actif',             desc: 'Travail physique modéré' },
  { key: 'tres_actif', label: '⚡ Très actif',        desc: 'Travail physique intense' },
]

export const DEFAULT_METRICS: PersonalMetrics = {
  gender: '',
  age: 0,
  weight: 0,
  height: 0,
  bodyFatPercent: null,
  workActivity: 'sedentaire',  // ← idem
  weeklySessions: 3,
}

export const DEFAULT_GOALS: NutritionalGoals = {
  goal: 'maintenance',
  mealsPerDay: 3,
  calories: 2000,
  proteinsG: 150,
  carbsG: 220,
  fatsG: 65,
}