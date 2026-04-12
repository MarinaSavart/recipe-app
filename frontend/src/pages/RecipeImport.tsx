import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { importFromUrl, importManual } from '../services/api'

type ToastType = 'success' | 'error'

interface Toast {
  msg: string
  type: ToastType
}

export default function RecipeImport() {
  const navigate = useNavigate()

  // Import URL
  const [url, setUrl] = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)

  // Import manuel
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [loadingManual, setLoadingManual] = useState(false)

  const [toast, setToast] = useState<Toast | null>(null)

  function showToast(msg: string, type: ToastType = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleImportUrl() {
    if (!url.trim()) return
    setLoadingUrl(true)
    try {
      const recipe = await importFromUrl(url.trim())
      showToast(`"${recipe.title}" importée !`)
      setTimeout(() => navigate(`/recipes/${recipe.id}`), 1000)
    } catch (e: any) {
      showToast(e.message, 'error')
    } finally {
      setLoadingUrl(false)
    }
  }

  async function handleImportManual() {
    if (!description.trim()) return
    setLoadingManual(true)
    try {
      const recipe = await importManual(description.trim(), sourceUrl || undefined)
      showToast(`"${recipe.title}" importée !`)
      setTimeout(() => navigate(`/recipes/${recipe.id}`), 1000)
    } catch (e: any) {
      showToast(e.message, 'error')
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

        {/* Import URL */}
        <div className="import-page__card">
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '16px', fontSize: '18px' }}>
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
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '16px', fontSize: '18px' }}>
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