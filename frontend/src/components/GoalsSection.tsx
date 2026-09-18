import { GOALS, type NutritionalGoals } from '../types/profil'
import MacroBox from './MacroBox'

interface GoalsSectionProps {
  goals: NutritionalGoals
  onChange: (goals: NutritionalGoals) => void
  saved: boolean
  onSave: () => void
}

export default function GoalsSection({ goals, onChange, saved, onSave }: GoalsSectionProps) {
  const perMeal = {
    calories: Math.round(goals.calories / goals.mealsPerDay),
    proteinsG: Math.round(goals.proteinsG / goals.mealsPerDay),
    carbsG: Math.round(goals.carbsG / goals.mealsPerDay),
    fatsG: Math.round(goals.fatsG / goals.mealsPerDay),
  }

  function update(patch: Partial<NutritionalGoals>) {
    onChange({ ...goals, ...patch })
  }

  return (
    <div className="profile__section">
      <div className="profile__section-title">Objectifs nutritionnels</div>

      {/* Régimes */}
      <div className="profile__regimes">
        {GOALS.map(r => (
          <button
            key={r.key}
            className={`profile__regime-btn ${goals.goal === r.key ? 'profile__regime-btn--active' : ''}`}
            onClick={() => update({ goal: r.key })}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Macros journalières */}
      <div className="profile__goals-grid">
        <div className="profile__goal-field">
          <label>Calories / jour (kcal)</label>
          <input
            type="number"
            value={goals.calories}
            onChange={e => update({ calories: Number(e.target.value), goal: 'personnalise' })}
          />
        </div>
        <div className="profile__goal-field">
          <label>Protéines / jour (g)</label>
          <input
            type="number"
            value={goals.proteinsG}
            onChange={e => update({ proteinsG: Number(e.target.value), goal: 'personnalise' })}
          />
        </div>
        <div className="profile__goal-field">
          <label>Glucides / jour (g)</label>
          <input
            type="number"
            value={goals.carbsG}
            onChange={e => update({ carbsG: Number(e.target.value), goal: 'personnalise' })}
          />
        </div>
        <div className="profile__goal-field">
          <label>Lipides / jour (g)</label>
          <input
            type="number"
            value={goals.fatsG}
            onChange={e => update({ fatsG: Number(e.target.value), goal: 'personnalise' })}
          />
        </div>
      </div>

      {/* Repas par jour */}
      <div className="profile__repas-selector">
        <label>Repas par jour</label>
        <div className="portions-selector">
          <button
            className="portions-selector__btn"
            onClick={() => update({ mealsPerDay: Math.max(1, goals.mealsPerDay - 1) })}
          >
            −
          </button>
          <span className="portions-selector__value">{goals.mealsPerDay}</span>
          <button
            className="portions-selector__btn"
            onClick={() => update({ mealsPerDay: Math.min(6, goals.mealsPerDay + 1) })}
          >
            +
          </button>
        </div>
      </div>

      {/* Macros par repas */}
      <div className="profile__per-meal">
        <div className="profile__per-meal-title">
          Objectif par repas ({goals.mealsPerDay} repas/jour)
        </div>
        <div className="profile__per-meal-macros">
          <MacroBox value={perMeal.calories} label="kcal" />
          <MacroBox value={perMeal.proteinsG} label="Prot." unit="g" />
          <MacroBox value={perMeal.carbsG} label="Gluc." unit="g" />
          <MacroBox value={perMeal.fatsG} label="Lip." unit="g" />
        </div>
      </div>

      <button className="btn-primary profile__save" onClick={onSave}>
        {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder mes objectifs'}
      </button>
    </div>
  )
}