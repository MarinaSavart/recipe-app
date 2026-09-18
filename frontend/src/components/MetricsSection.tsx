import { useState } from 'react'
import { WORK_ACTIVITIES, type PersonalMetrics } from '../types/profil'

interface MetricsSectionProps {
  metrics: PersonalMetrics
  onChange: (metrics: PersonalMetrics) => void
  tdee: number | null
  onRecalculate: () => void
  isPersonnalise: boolean
  saved: boolean
  onSave: () => void
}

export default function MetricsSection({
  metrics,
  onChange,
  tdee,
  onRecalculate,
  isPersonnalise,
  saved,
  onSave,
}: MetricsSectionProps) {
  const [showMassGrasse, setShowMassGrasse] = useState(metrics.bodyFatPercent !== null)

  function update(patch: Partial<PersonalMetrics>) {
    onChange({ ...metrics, ...patch })
  }

  return (
    <div className="profile__section">
      <div className="profile__section-title">Mes métriques</div>

      {/* Gender */}
      <div className="profile__regimes profile__regimes--tight">
        {(['homme', 'femme'] as const).map(s => (
          <button
            key={s}
            className={`profile__regime-btn ${metrics.gender === s ? 'profile__regime-btn--active' : ''}`}
            onClick={() => update({ gender: s })}
          >
            {s === 'homme' ? '👨 Homme' : '👩 Femme'}
          </button>
        ))}
      </div>

      {/* Champs numériques */}
      <div className="profile__goals-grid">
        <div className="profile__goal-field">
          <label>Âge</label>
          <input
            type="number"
            placeholder="28"
            value={metrics.age || ''}
            onChange={e => update({ age: Number(e.target.value) })}
          />
        </div>
        <div className="profile__goal-field">
          <label>Poids (kg)</label>
          <input
            type="number"
            placeholder="68"
            value={metrics.weight || ''}
            onChange={e => update({ weight: Number(e.target.value) })}
          />
        </div>
        <div className="profile__goal-field">
          <label>Taille (cm)</label>
          <input
            type="number"
            placeholder="168"
            value={metrics.height || ''}
            onChange={e => update({ height: Number(e.target.value) })}
          />
        </div>
        <div className="profile__goal-field">
          <label className="profile__field-label-row">
            % Masse grasse
            <button
              onClick={() => {
                setShowMassGrasse(v => !v)
                update({ bodyFatPercent: null })
              }}
              className="profile__toggle-link"
            >
              {showMassGrasse ? '− Retirer' : '+ Ajouter'}
            </button>
          </label>
          {showMassGrasse ? (
            <input
              type="number"
              placeholder="20"
              value={metrics.bodyFatPercent ?? ''}
              onChange={e => update({ bodyFatPercent: Number(e.target.value) || null })}
            />
          ) : (
            <input disabled placeholder="Non renseigné" />
          )}
        </div>
      </div>

      {/* Activité pro */}
      <div className="profile__field-group">
        <div className="profile__field-label">
          Activité professionnelle
        </div>
        <div className="profile__regimes">
          {WORK_ACTIVITIES.map(a => (
            <button
              key={a.key}
              className={`profile__regime-btn ${metrics.workActivity === a.key ? 'profile__regime-btn--active' : ''}`}
              onClick={() => update({ workActivity: a.key as PersonalMetrics['workActivity'] })}
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
          <button
            className="portions-selector__btn"
            onClick={() => update({ weeklySessions: Math.max(0, metrics.weeklySessions - 1) })}
          >
            −
          </button>
          <span className="portions-selector__value">{metrics.weeklySessions}</span>
          <button
            className="portions-selector__btn"
            onClick={() => update({ weeklySessions: Math.min(14, metrics.weeklySessions + 1) })}
          >
            +
          </button>
        </div>
      </div>
      <div className="profile__hint">
        💡 Basé sur une moyenne de 60 min par séance. Le TDEE réel peut varier selon l'intensité.
      </div>

      {/* TDEE */}
      {tdee ? (
        <div className="profile__tdee-box profile__tdee-box--filled">
          <span>
            🔥 TDEE estimé :
            <strong className="profile__tdee-value">
              {tdee} kcal / jour
            </strong>
            <span className="profile__tdee-method">
              {metrics.bodyFatPercent ? '(Katch-McArdle)' : '(Mifflin-St Jeor)'}
            </span>
          </span>
          {!isPersonnalise && (
            <button
              className="btn-primary btn-primary--sm"
              onClick={onRecalculate}
            >
              ↻ Recalculer
            </button>
          )}
        </div>
      ) : (
        <div className="profile__tdee-box">
          💡 Remplis tes métriques pour obtenir un calcul automatique
        </div>
      )}

      <button className="btn-primary profile__save" onClick={onSave}>
        {saved ? '✅ Métriques sauvegardées !' : '💾 Sauvegarder mes métriques'}
      </button>
    </div>
  )
}