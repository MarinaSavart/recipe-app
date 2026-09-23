import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteMenu, getMenus } from '../services/api'
import type { MenuListItem } from '../types/menu'
import { formatShortDate } from '../utils/menu'

type MenusState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; menus: MenuListItem[] }

/** Lists the user's saved weekly menus, with create / view / delete actions. */
export default function MenuList() {
  const navigate = useNavigate()
  const [state, setState] = useState<MenusState>({ status: 'loading' })

  useEffect(() => {
    getMenus()
      .then(menus => setState({ status: 'ready', menus }))
      .catch((e: Error) => setState({ status: 'error', message: e.message }))
  }, [])

  /** Deletes a menu after confirmation and removes it from the list. */
  async function handleDelete(menu: MenuListItem) {
    if (!confirm(`Supprimer le menu "${menu.name}" ?`)) return
    try {
      await deleteMenu(menu.id)
      setState(s => s.status === 'ready' ? { ...s, menus: s.menus.filter(m => m.id !== menu.id) } : s)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="menu-list">
      <div className="page-header menu-list__header">
        <div>
          <h1 className="page-header__title">Mes <em>menus</em></h1>
          <p className="page-header__sub">Tes menus, composés à partir de tes recettes « repas ».</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/menus/create')}>
          ＋ Créer un menu
        </button>
      </div>

      {state.status === 'loading' ? (
        <div className="empty">
          <div className="empty__icon">⏳</div>
          <div className="empty__title">Chargement…</div>
        </div>
      ) : state.status === 'error' ? (
        <div className="empty">
          <div className="empty__icon">⚠️</div>
          <div className="empty__title">Erreur</div>
          <div className="empty__sub">{state.message}</div>
        </div>
      ) : state.menus.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">📅</div>
          <div className="empty__title">Aucun menu pour l'instant</div>
          <div className="empty__sub">
            <button className="btn-ghost empty__cta" onClick={() => navigate('/menus/create')}>
              ⚡ Générer mon premier menu
            </button>
          </div>
        </div>
      ) : (
        <ul className="menu-list__items">
          {state.menus.map(menu => (
            <li key={menu.id} className="menu-list__item">
              <div className="menu-list__info">
                <div className="menu-list__name">{menu.name}</div>
                <div className="menu-list__meta">
                  Créé le {formatShortDate(menu.createdAt)} · {menu.mealsCount} repas · {menu.recipesCount} recette{menu.recipesCount > 1 ? 's' : ''}
                </div>
              </div>
              <div className="menu-list__actions">
                <button className="btn-ghost" onClick={() => navigate(`/menus/${menu.id}`)}>Voir</button>
                <button className="btn-ghost btn-ghost--danger" onClick={() => handleDelete(menu)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
