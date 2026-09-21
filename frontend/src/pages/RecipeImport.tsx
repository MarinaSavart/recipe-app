import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { importFromUrl, importManual } from '../services/api'
import { CATEGORIES, type CategoryKey } from '../utils/categories'

type ToastType = 'success' | 'error'

interface Toast {
  msg: string
  type: ToastType
}

/** Recipe import page: automatic import from a URL, or manual import from a pasted description. */
export default function RecipeImport() {
  const navigate = useNavigate()

  // Import URL
  const [url, setUrl] = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)

  // Import manuel
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [loadingManual, setLoadingManual] = useState(false)

  // Optional category, shared between both import modes — useful when the
  // video doesn't make it clear whether it's a meal, dessert, snack, etc.
  const [category, setCategory] = useState<CategoryKey | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)

  /** Shows a transient toast notification. */
  function showToast(msg: string, type: ToastType = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  /** Submits the URL for automatic import and navigates to the created recipe. */
  async function handleImportUrl() {
    if (!url.trim()) return
    setLoadingUrl(true)
    try {
      const recipe = await importFromUrl(url.trim(), category ?? undefined)
      showToast(`"${recipe.title}" importée !`)
      setTimeout(() => navigate(`/recipes/${recipe.id}`), 1000)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setLoadingUrl(false)
    }
  }

  /** Submits the pasted description for manual import and navigates to the created recipe. */
  async function handleImportManual() {
    if (!description.trim()) return
    setLoadingManual(true)
    try {
      const recipe = await importManual(description.trim(), sourceUrl || undefined, category ?? undefined)
      showToast(`"${recipe.title}" importée !`)
      setTimeout(() => navigate(`/recipes/${recipe.id}`), 1000)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setLoadingManual(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">Importer une <em>recette</em></h1>
        <p className="page-header__sub">
          Depuis une URL ou en collant la description directement
        </p>
      </div>

      <div className="import-page">

        {/* Category override — applies to whichever import mode is used below */}
        <div className="import-page__card">
          <h2 className="import-page__card-title">
            🏷️ Catégorie
          </h2>
          <label className="import-page__label">
            Laisse vide pour laisser l'IA deviner, ou choisis-en une si la vidéo ne le précise pas
          </label>
          <div className="category-filters">
            <button
              className={`category-filters__btn ${category === null ? 'category-filters__btn--active' : ''}`}
              onClick={() => setCategory(null)}
            >
              Auto
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={`category-filters__btn ${category === c.key ? 'category-filters__btn--active' : ''}`}
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Import URL */}
        <div className="import-page__card">
          <h2 className="import-page__card-title">
            ⚡ Import automatique
          </h2>
          <label className="import-page__label">
            Lien Instagram ou TikTok
          </label>
          <input
            className="import-page__input"
            type="url"
            placeholder="https://www.instagram.com/reel/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImportUrl()}
          />
          <button
            className="btn-primary"
            onClick={handleImportUrl}
            disabled={loadingUrl || !url.trim()}
          >
            {loadingUrl ? (
              <><span className="spinner" />Extraction en cours…</>
            ) : (
              '⚡ Importer depuis l\'URL'
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="import-page__divider">ou</div>

        {/* Import manuel */}
        <div className="import-page__card">
          <h2 className="import-page__card-title">
            ✍️ Import manuel
          </h2>
          <label className="import-page__label">
            Description de la recette
          </label>
          <textarea
            className="import-page__input"
            placeholder="Colle ici la description de la vidéo…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
          />
          <label className="import-page__label">
            URL source (optionnel)
          </label>
          <input
            className="import-page__input"
            type="url"
            placeholder="https://www.instagram.com/reel/..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={handleImportManual}
            disabled={loadingManual || !description.trim()}
          >
            {loadingManual ? (
              <><span className="spinner" />Analyse en cours…</>
            ) : (
              '✍️ Importer la description'
            )}
          </button>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </>
  )
}