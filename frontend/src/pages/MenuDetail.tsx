import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MenuRecipeRow from '../components/MenuRecipeRow'
import NutritionSummary from '../components/NutritionSummary'
import RecipePickerModal from '../components/RecipePickerModal'
import ShoppingList from '../components/ShoppingList'
import { useAuth } from '../context/AuthContext'
import {
  addMenuItem,
  deleteMenu,
  deleteMenuItem,
  getMenu,
  getRecipes,
  getShoppingList,
  updateMenu,
  updateMenuItem,
} from '../services/api'
import { loadGoals } from '../services/goals'
import type { Menu, MenuItem, ShoppingListItem } from '../types/menu'
import { DEFAULT_GOALS, type NutritionalGoals } from '../types/profil'
import type { RecipeListItem } from '../types/recipe'
import { averagePerMeal, groupByCategory, perMealTargets, totalMeals } from '../utils/menu'

type MenuState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; menu: Menu }

/** Which recipe picker is open: replacing a recipe of the menu, or adding a new one. */
type PickerState =
  | { mode: 'replace'; item: MenuItem }
  | { mode: 'add' }
  | null

type Toast = { msg: string; type: 'success' | 'error' }

/** Shopping list panel: closed, or open (items kept while reloading after a menu change). */
type ShoppingState =
  | { status: 'closed' }
  | { status: 'loading'; items: ShoppingListItem[] }
  | { status: 'ready'; items: ShoppingListItem[] }

/** A menu as a list of recipes grouped by category, with edit actions and a nutritional recap. */
export default function MenuDetail() {
  const { id } = useParams<{ id: string }>()
  const menuId = Number(id)
  const navigate = useNavigate()
  const userId = useAuth().user?.id

  const [state, setState] = useState<MenuState>({ status: 'loading' })
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [goals, setGoals] = useState<NutritionalGoals>(DEFAULT_GOALS)
  const [nameDraft, setNameDraft] = useState('')
  const [picker, setPicker] = useState<PickerState>(null)
  const [busy, setBusy] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [shopping, setShopping] = useState<ShoppingState>({ status: 'closed' })
  const shoppingRef = useRef<HTMLElement>(null)

  useEffect(() => {
    getMenu(menuId)
      .then(menu => {
        setState({ status: 'ready', menu })
        setNameDraft(menu.name)
      })
      .catch((e: Error) => setState({ status: 'error', message: e.message }))
    getRecipes().then(setRecipes).catch(console.error)
    if (userId) loadGoals(userId).then(setGoals).catch(console.error)
  }, [menuId, userId])

  /** Shows a transient toast notification. */
  function showToast(msg: string, type: Toast['type']) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  if (state.status === 'loading') {
    return (
      <div className="empty">
        <div className="empty__icon">⏳</div>
        <div className="empty__title">Chargement…</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="empty">
        <div className="empty__icon">⚠️</div>
        <div className="empty__title">Erreur</div>
        <div className="empty__sub">{state.message}</div>
      </div>
    )
  }

  const { menu } = state
  const meals = totalMeals(menu.items)
  const trimmedName = nameDraft.trim()

  /** Opens (or refreshes) the shopping list from the menu's current portions. */
  function loadShoppingList() {
    setShopping(s => ({ status: 'loading', items: s.status === 'closed' ? [] : s.items }))
    getShoppingList(menu.id)
      .then(items => setShopping({ status: 'ready', items }))
      .catch((e: Error) => {
        setShopping({ status: 'closed' })
        showToast(e.message, 'error')
      })
  }

  /** Opens the list (below the recipes, so scrolls to it) or closes it. */
  function toggleShoppingList() {
    if (shopping.status !== 'closed') {
      setShopping({ status: 'closed' })
      return
    }
    loadShoppingList()
    requestAnimationFrame(() => shoppingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  /** Runs a menu mutation, applies the returned menu and reports errors. */
  async function mutate(action: () => Promise<Menu | void>, successMsg?: string) {
    setBusy(true)
    try {
      const updated = await action()
      if (updated) setState({ status: 'ready', menu: updated })
      if (successMsg) showToast(successMsg, 'success')
      // Portions or recipes may have changed: keep the open shopping list in sync
      if (shopping.status !== 'closed') loadShoppingList()
      return true
    } catch (e) {
      showToast((e as Error).message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Applies the recipe picked in the modal: replaces a recipe, or adds a new one. */
  async function handlePick(recipe: RecipeListItem) {
    if (!picker) return
    const ok = picker.mode === 'replace'
      ? await mutate(() => updateMenuItem(menu.id, picker.item.id, recipe.id))
      : await mutate(() => addMenuItem(menu.id, recipe.id))
    if (ok) setPicker(null)
  }

  async function handleDeleteItem(item: MenuItem) {
    await mutate(async () => {
      await deleteMenuItem(menu.id, item.id)
      setState(s => s.status === 'ready'
        ? { ...s, menu: { ...s.menu, items: s.menu.items.filter(i => i.id !== item.id) } }
        : s)
    })
  }

  /** Changes how many portions of a recipe the menu uses. */
  function handlePortionsChange(item: MenuItem, portions: number) {
    if (!item.recipe) return Promise.resolve(false)
    const recipeId = item.recipe.id
    return mutate(() => updateMenuItem(menu.id, item.id, recipeId, portions))
  }

  async function handleRename() {
    if (!trimmedName) return
    await mutate(() => updateMenu(menu.id, { name: trimmedName }), 'Menu enregistré ✓')
  }

  async function handleDeleteMenu() {
    if (!confirm(`Supprimer le menu "${menu.name}" ?`)) return
    const ok = await mutate(() => deleteMenu(menu.id))
    if (ok) navigate('/menus')
  }

  return (
    <div className="menu-detail">
      <button className="detail__back" onClick={() => navigate('/menus')}>← Mes menus</button>

      <div className="menu-detail__header">
        <input
          className="menu-detail__name"
          value={nameDraft}
          maxLength={255}
          onChange={e => setNameDraft(e.target.value)}
          aria-label="Nom du menu"
        />
        <p className={`menu-detail__count ${meals === menu.mealsCount ? '' : 'menu-detail__count--off'}`}>
          {meals} / {menu.mealsCount} repas · {menu.items.length} recette{menu.items.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="menu-detail__actions">
        <button
          className="btn-primary btn-primary--sm"
          onClick={() => setPicker({ mode: 'add' })}
          disabled={busy}
        >
          ＋ Ajouter une recette
        </button>
        <button
          className={`btn-ghost menu-detail__toggle ${showSummary ? 'menu-detail__toggle--active' : ''}`}
          onClick={() => setShowSummary(s => !s)}
          aria-expanded={showSummary}
        >
          📊 Récapitulatif nutritionnel
        </button>
        <button
          className={`btn-ghost menu-detail__toggle ${shopping.status !== 'closed' ? 'menu-detail__toggle--active' : ''}`}
          onClick={toggleShoppingList}
          aria-expanded={shopping.status !== 'closed'}
          disabled={menu.items.length === 0}
        >
          🛒 Liste de courses
        </button>
        <button
          className="btn-ghost"
          onClick={handleRename}
          disabled={busy || !trimmedName || trimmedName === menu.name}
        >
          💾 Sauvegarder
        </button>
        <button className="btn-ghost btn-ghost--danger" onClick={handleDeleteMenu} disabled={busy}>
          🗑 Supprimer le menu
        </button>
      </div>

      {showSummary && (
        <NutritionSummary average={averagePerMeal(menu.items)} targets={perMealTargets(goals)} />
      )}

      <div className="menu-detail__body">
        <div className="menu-detail__main">
          {menu.items.length === 0 ? (
            <div className="empty">
              <div className="empty__icon">🍽️</div>
              <div className="empty__title">Ce menu est vide</div>
              <div className="empty__sub">Ajoute une recette pour commencer.</div>
            </div>
          ) : (
            groupByCategory(menu.items).map(group => (
              <section key={group.key} className="menu-detail__group">
                <h2 className="menu-detail__group-title">{group.label}</h2>
                <ul className="menu-detail__recipes">
                  {group.items.map(item => (
                    <MenuRecipeRow
                      key={item.id}
                      item={item}
                      disabled={busy}
                      onReplace={i => setPicker({ mode: 'replace', item: i })}
                      onDelete={handleDeleteItem}
                      onPortionsChange={handlePortionsChange}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {shopping.status !== 'closed' && (
          <ShoppingList
            ref={shoppingRef}
            items={shopping.items}
            loading={shopping.status === 'loading' && shopping.items.length === 0}
            onClose={() => setShopping({ status: 'closed' })}
          />
        )}
      </div>

      {picker && (
        <RecipePickerModal
          title={picker.mode === 'replace' ? 'Remplacer la recette' : 'Ajouter une recette'}
          recipes={recipes}
          onSelect={handlePick}
          onClose={() => setPicker(null)}
          busy={busy}
          initialCategory={picker.mode === 'replace' ? picker.item.recipe?.category ?? null : null}
        />
      )}

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
