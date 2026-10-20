import type { MealNutrition } from '../types/menu'
import { isWithinTolerance } from '../utils/menu'

interface NutritionSummaryProps {
  average: MealNutrition | null
  targets: MealNutrition
}

const ROWS: { key: keyof MealNutrition; label: string; unit: string }[] = [
  { key: 'calories',  label: 'Calories',  unit: 'kcal' },
  { key: 'proteinsG', label: 'Protéines', unit: 'g' },
  { key: 'carbsG',    label: 'Glucides',  unit: 'g' },
  { key: 'fatsG',     label: 'Lipides',   unit: 'g' },
]

/** Average nutrition per meal of a menu, compared to the per-meal goals (green within ±15%). */
export default function NutritionSummary({ average, targets }: NutritionSummaryProps) {
  if (!average) {
    return <section className="menu-summary menu-summary--empty">Aucun repas dans ce menu.</section>
  }

  return (
    <section className="menu-summary">
      <p className="menu-summary__intro">
        Moyenne par repas (desserts, collations… inclus), comparée à ton objectif par repas — vert : à ±15 % de l'objectif.
      </p>
      <div className="menu-summary__grid">
        {ROWS.map(({ key, label, unit }) => (
          <div
            key={key}
            className={`menu-summary__macro ${
              isWithinTolerance(average[key], targets[key]) ? 'menu-summary__macro--ok' : 'menu-summary__macro--warning'
            }`}
          >
            <div className="menu-summary__label">{label}</div>
            <div className="menu-summary__value">
              {Math.round(average[key])} <span className="menu-summary__unit">{unit}</span>
            </div>
            <div className="menu-summary__target">objectif {Math.round(targets[key])} {unit}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
