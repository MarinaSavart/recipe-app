import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { generateMenu } from '../services/api'
import { loadGoals } from '../services/goals'
import { defaultMenuName } from '../utils/menu'

const MIN_MEALS = 1
const MAX_MEALS = 28

type GenerationState =
  | { status: 'idle' }
  | { status: 'generating' }
  | { status: 'error'; message: string }

/** Configuration form for a new menu: a name and a number of meals, filled by Ollama. */
export default function MenuCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [name, setName] = useState(defaultMenuName)
  const [mealsCount, setMealsCount] = useState(7)
  const [generation, setGeneration] = useState<GenerationState>({ status: 'idle' })

  const generating = generation.status === 'generating'
  const canSubmit = name.trim() !== '' && !generating

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setGeneration({ status: 'generating' })
    try {
      // Makes sure goals saved only in localStorage reach the backend before generating
      if (user) await loadGoals(user.id)
      const menu = await generateMenu({ name: name.trim(), mealsCount })
      navigate(`/menus/${menu.id}`)
    } catch (err) {
      setGeneration({ status: 'error', message: (err as Error).message })
    }
  }

  return (
    <div className="menu-create">
      <button className="detail__back" onClick={() => navigate('/menus')}>← Mes menus</button>

      <div className="page-header">
        <h1 className="page-header__title">Créer un <em>menu</em></h1>
        <p className="page-header__sub">
          Ollama choisit des recettes « repas » pour couvrir tes repas, au plus près de tes objectifs nutritionnels.
        </p>
      </div>

      <form className="menu-create__card" onSubmit={handleSubmit}>
        <label className="menu-create__label" htmlFor="menu-name">Nom du menu</label>
        <input
          id="menu-name"
          className="menu-create__input"
          type="text"
          maxLength={255}
          placeholder='ex : "Semaine du 23 sept."'
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={generating}
        />
        {name.trim() === '' && <p className="menu-create__error">Le nom est requis.</p>}

        <span className="menu-create__label">Nombre de repas</span>
        <div className="portions-selector menu-create__field">
          <button
            type="button"
            className="portions-selector__btn"
            onClick={() => setMealsCount(n => Math.max(MIN_MEALS, n - 1))}
            disabled={generating || mealsCount <= MIN_MEALS}
            aria-label="Moins de repas"
          >
            −
          </button>
          <span className="portions-selector__value">{mealsCount}</span>
          <button
            type="button"
            className="portions-selector__btn"
            onClick={() => setMealsCount(n => Math.min(MAX_MEALS, n + 1))}
            disabled={generating || mealsCount >= MAX_MEALS}
            aria-label="Plus de repas"
          >
            +
          </button>
        </div>
        <p className="menu-create__hint menu-create__hint--left">
          Une recette de 3 portions couvre 3 repas.
        </p>

        <button type="submit" className="btn-primary menu-create__submit" disabled={!canSubmit}>
          {generating ? <><span className="spinner" />Ollama compose ton menu… ⏳</> : 'Générer mon menu ⚡'}
        </button>

        {generating && (
          <p className="menu-create__hint">La génération peut prendre une à deux minutes.</p>
        )}
        {generation.status === 'error' && (
          <p className="menu-create__error">{generation.message}</p>
        )}
      </form>
    </div>
  )
}
