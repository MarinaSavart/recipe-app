import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRecipe, updateRecipe, uploadPhoto } from '../services/api'
import type { Recipe, Ingredient, Step } from '../types/recipe'
import { resolveMediaUrl } from '../utils/recipeDisplay'

interface EditIngredient extends Omit<Ingredient, 'id'> { id?: number }
interface EditStep extends Omit<Step, 'id'> { id?: number }

type EditIngredientTextField = Exclude<keyof EditIngredient, 'id' | 'position'>
type EditStepTextField = Exclude<keyof EditStep, 'id' | 'position'>

/** Recipe edit form: general info, macros, photo, ingredients, and steps. */
export default function RecipeEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Simple fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [calories, setCalories] = useState('')
  const [proteins, setProteins] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  // Lists
  const [ingredients, setIngredients] = useState<EditIngredient[]>([])
  const [steps, setSteps] = useState<EditStep[]>([])

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** Shows a transient toast notification. */
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (!id) return
    getRecipe(Number(id))
      .then((data) => {
        setRecipe(data)
        setTitle(data.title)
        setDescription(data.description ?? '')
        setServings(data.servings?.toString() ?? '')
        setPrepTime(data.prep_time_minutes?.toString() ?? '')
        setCookTime(data.cook_time_minutes?.toString() ?? '')
        setCalories(data.calories?.toString() ?? '')
        setProteins(data.proteins_g?.toString() ?? '')
        setCarbs(data.carbs_g?.toString() ?? '')
        setFats(data.fats_g?.toString() ?? '')
        setTagsInput(data.tags.map(t => t.name).join(', '))
        setIngredients(data.ingredients)
        setSteps(data.steps)
        if (data.thumbnail_url) {
          setPhotoPreview(resolveMediaUrl(data.thumbnail_url))
        }
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [id])

  // ── Photo ──────────────────────────────────────────────────────────────────

  /** Stores the selected photo file and generates a local preview URL for it. */
  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // ── Ingredients ────────────────────────────────────────────────────────────

  /** Updates a single field of the ingredient at the given index. */
  function updateIngredient(index: number, field: EditIngredientTextField, value: string) {
    setIngredients(prev => prev.map((ing, i) =>
      i === index ? { ...ing, [field]: value || null } : ing
    ))
  }

  /** Appends a new empty ingredient row. */
  function addIngredient() {
    setIngredients(prev => [...prev, {
      name: '', quantity: null, unit: null, notes: null,
      position: prev.length
    }])
  }

  /** Removes the ingredient at the given index and re-numbers the remaining positions. */
  function removeIngredient(index: number) {
    setIngredients(prev => prev.filter((_, i) => i !== index)
      .map((ing, i) => ({ ...ing, position: i })))
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  /** Updates a single field of the step at the given index. */
  function updateStep(index: number, field: EditStepTextField, value: string) {
    setSteps(prev => prev.map((step, i) =>
      i === index ? {
        ...step,
        [field]: field === 'duration_minutes'
          ? (value ? parseInt(value) : null)
          : value
      } : step
    ))
  }

  /** Appends a new empty step row. */
  function addStep() {
    setSteps(prev => [...prev, {
      content: '', position: prev.length, duration_minutes: null
    }])
  }

  /** Removes the step at the given index and re-numbers the remaining positions. */
  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, position: i })))
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  /** Uploads the new photo (if any) and saves the recipe's fields, then navigates to the detail page. */
  async function handleSave() {
    if (!recipe || !title.trim()) return
    setSaving(true)
    try {
      // 1. Upload photo if new
      if (photoFile) {
        await uploadPhoto(recipe.id, photoFile)
      }

      // 2. Patch the recipe
      await updateRecipe(recipe.id, {
        title: title.trim(),
        description: description || null,
        servings: servings ? parseInt(servings) : null,
        prep_time_minutes: prepTime ? parseInt(prepTime) : null,
        cook_time_minutes: cookTime ? parseInt(cookTime) : null,
        calories: calories ? parseFloat(calories) : null,
        proteins_g: proteins ? parseFloat(proteins) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fats_g: fats ? parseFloat(fats) : null,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        ingredients: ingredients
          .filter(ing => ing.name.trim())
          .map((ing, i) => ({ ...ing, position: i })),
        steps: steps
          .filter(s => s.content.trim())
          .map((s, i) => ({ ...s, position: i })),
      })

      showToast('Recette sauvegardée !')
      setTimeout(() => navigate(`/recipes/${recipe.id}`), 1000)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erreur inconnue', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="empty">
      <div className="empty__icon">⏳</div>
      <div className="empty__title">Chargement…</div>
    </div>
  )

  if (!recipe) return null

  return (
    <>
      <div className="page-header">
        <button className="detail__back" onClick={() => navigate(`/recipes/${recipe.id}`)}>
          ← Retour
        </button>
        <h1 className="page-header__title">Modifier la <em>recette</em></h1>
      </div>

      <div className="edit-page">

        {/* Photo */}
        <div className="edit-section">
          <div className="edit-section__title">Photo</div>
          <div className="photo-upload">
            {photoPreview ? (
              <img className="photo-upload__preview" src={photoPreview} alt="" />
            ) : (
              <div
                className="photo-upload__placeholder"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="icon">📷</span>
                <span>Clique pour ajouter une photo</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="photo-upload__input"
              onChange={handlePhotoChange}
            />
            <button
              className="btn-ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? '🔄 Changer la photo' : '📷 Ajouter une photo'}
            </button>
          </div>
        </div>

        {/* General info */}
        <div className="edit-section">
          <div className="edit-section__title">Informations générales</div>
          <div className="edit-page__grid">

            <div className="edit-page__full">
              <div className="edit-field">
                <label className="edit-field__label">Titre *</label>
                <input
                  className="edit-field__input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Titre de la recette"
                />
              </div>
            </div>

            <div className="edit-page__full">
              <div className="edit-field">
                <label className="edit-field__label">Description</label>
                <textarea
                  className="edit-field__input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Description courte…"
                />
              </div>
            </div>

            <div className="edit-field">
              <label className="edit-field__label">Portions</label>
              <input className="edit-field__input" type="number" value={servings} onChange={e => setServings(e.target.value)} placeholder="4" />
            </div>

            <div className="edit-field">
              <label className="edit-field__label">Tags (séparés par des virgules)</label>
              <input className="edit-field__input" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="meal prep, protéiné…" />
            </div>

            <div className="edit-field">
              <label className="edit-field__label">Temps de préparation (min)</label>
              <input className="edit-field__input" type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="15" />
            </div>

            <div className="edit-field">
              <label className="edit-field__label">Temps de cuisson (min)</label>
              <input className="edit-field__input" type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="30" />
            </div>

          </div>
        </div>

        {/* Macros */}
        <div className="edit-section">
          <div className="edit-section__title">Macros (par portion)</div>
          <div className="edit-page__grid">
            <div className="edit-field">
              <label className="edit-field__label">Calories (kcal)</label>
              <input className="edit-field__input" type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="340" />
            </div>
            <div className="edit-field">
              <label className="edit-field__label">Protéines (g)</label>
              <input className="edit-field__input" type="number" value={proteins} onChange={e => setProteins(e.target.value)} placeholder="45" />
            </div>
            <div className="edit-field">
              <label className="edit-field__label">Glucides (g)</label>
              <input className="edit-field__input" type="number" value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="30" />
            </div>
            <div className="edit-field">
              <label className="edit-field__label">Lipides (g)</label>
              <input className="edit-field__input" type="number" value={fats} onChange={e => setFats(e.target.value)} placeholder="9" />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="edit-section">
          <div className="edit-section__title">Ingrédients (quantités pour 1 portion)</div>
          {ingredients.map((ing, i) => (
            <div key={i} className="edit-row">
              <div className="edit-row__inputs">
                <input
                  className="edit-field__input edit-row__name"
                  placeholder="Nom"
                  value={ing.name}
                  onChange={e => updateIngredient(i, 'name', e.target.value)}
                />
                <input
                  className="edit-field__input edit-row__qty"
                  placeholder="Qté"
                  value={ing.quantity ?? ''}
                  onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                />
                <input
                  className="edit-field__input edit-row__unit"
                  placeholder="Unité"
                  value={ing.unit ?? ''}
                  onChange={e => updateIngredient(i, 'unit', e.target.value)}
                />
                <input
                  className="edit-field__input edit-row__notes"
                  placeholder="Notes"
                  value={ing.notes ?? ''}
                  onChange={e => updateIngredient(i, 'notes', e.target.value)}
                />
              </div>
              <button className="edit-row__remove" onClick={() => removeIngredient(i)}>×</button>
            </div>
          ))}
          <button className="btn-add" onClick={addIngredient}>+ Ajouter un ingrédient</button>
        </div>

        {/* Steps */}
        <div className="edit-section">
          <div className="edit-section__title">Étapes</div>
          {steps.map((step, i) => (
            <div key={i} className="edit-row">
              <div className="edit-row__inputs">
                <textarea
                  className="edit-field__input edit-row__name"
                  placeholder={`Étape ${i + 1}`}
                  value={step.content}
                  onChange={e => updateStep(i, 'content', e.target.value)}
                  rows={2}
                />
                <input
                  className="edit-field__input edit-row__qty"
                  placeholder="Durée (min)"
                  type="number"
                  value={step.duration_minutes?.toString() ?? ''}
                  onChange={e => updateStep(i, 'duration_minutes', e.target.value)}
                />
              </div>
              <button className="edit-row__remove" onClick={() => removeStep(i)}>×</button>
            </div>
          ))}
          <button className="btn-add" onClick={addStep}>+ Ajouter une étape</button>
        </div>

        {/* Actions */}
        <div className="edit-page__actions">
          <button
            className="btn-primary edit-page__save-btn"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? <><span className="spinner" />Sauvegarde…</> : '💾 Sauvegarder'}
          </button>
          <button
            className="btn-ghost"
            onClick={() => navigate(`/recipes/${recipe.id}`)}
          >
            Annuler
          </button>
        </div>

      </div>

      {toast && (
        <div className={`toast toast--${toast.type}`}>{toast.msg}</div>
      )}
    </>
  )
}