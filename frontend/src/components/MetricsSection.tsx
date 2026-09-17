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
      <div className="profile__regimes" style={{ marginBottom: '16px' }}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            % Masse grasse
            <button
              onClick={() => {
                setShowMassGrasse(v => !v)
                update({ bodyFatPercent: null })
              }}
              style={{ fontSize: 11, color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer' }}
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
            <input disabled placeholder="Non renseigné" style={{ opacity: 0.4, cursor: 'not-allowed' }} />
          )}
        </div>
      </div>

      {/* Activité pro */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: '8px' }}>
          Activité professionnelle
        </div>
        <div className="profile__regimes">
          {WORK_ACTIVITIES.map(a => (
            <button
              key={a.key}
              className={`profile__regime-btn ${metrics.workactivity === a.key ? 'profile__regime-btn--active' : ''}`}
              onClick={() => update({ workactivity: a.key as PersonalMetrics['workactivity'] })}
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
            onClick={() => update({ weeklysessions: Math.max(0, metrics.weeklysessions - 1) })}
          >
            −
          </button>
          <span className="portions-selector__value">{metrics.weeklysessions}</span>
          <button
            className="portions-selector__btn"
            onClick={() => update({ weeklysessions: Math.min(14, metrics.weeklysessions + 1) })}
          >
            +
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: '16px', marginTop: '-8px' }}>
        💡 Basé sur une moyenne de 60 min par séance. Le TDEE réel peut varier selon l'intensité.
      </div>

      {/* TDEE */}
      {tdee ? (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: 13,
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            🔥 TDEE estimé :
            <strong style={{ color: 'var(--amber)', marginLeft: '8px', fontSize: 16 }}>
              {tdee} kcal / jour
            </strong>
            <span style={{ fontSize: 11, marginLeft: '8px' }}>
              {metrics.bodyFatPercent ? '(Katch-McArdle)' : '(Mifflin-St Jeor)'}
            </span>
          </span>
          {!isPersonnalise && (
            <button
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: 13 }}
              onClick={onRecalculate}
            >
              ↻ Recalculer
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: 13,
            color: 'var(--muted)',
          }}
        >
          💡 Remplis tes métriques pour obtenir un calcul automatique
        </div>
      )}

      <button className="btn-primary profile__save" onClick={onSave}>
        {saved ? '✅ Métriques sauvegardées !' : '💾 Sauvegarder mes métriques'}
      </button>
    </div>
  )
}