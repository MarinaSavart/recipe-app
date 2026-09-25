import { useState } from 'react'
import type { Ref } from 'react'
import type { ShoppingListItem } from '../types/menu'
import { buildShoppingSections } from '../utils/shoppingList'

interface ShoppingListProps {
  items: ShoppingListItem[]
  loading: boolean
  onClose: () => void
  ref?: Ref<HTMLElement>
}

/**
 * Shopping list: ingredients grouped by store aisle (quantities for the menu's
 * portions, aisles laid out in columns), then the ones to check in the cupboard.
 * Lines can be ticked off.
 */
export default function ShoppingList({ items, loading, onClose, ref }: ShoppingListProps) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  const sections = buildShoppingSections(items)
  const total = sections.reduce((sum, s) => sum + s.rows.length, 0)
  const done = sections.reduce((sum, s) => sum + s.rows.filter(r => checked.has(r.key)).length, 0)

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <aside ref={ref} className="shopping-list" aria-label="Liste de courses">
      <div className="shopping-list__header">
        <div>
          <h2 className="shopping-list__title">🛒 Liste de courses</h2>
          <p className="shopping-list__hint">Pour les portions de ton menu</p>
        </div>
        <button className="shopping-list__close" onClick={onClose} aria-label="Fermer la liste de courses">×</button>
      </div>

      {loading ? (
        <p className="shopping-list__empty">Chargement…</p>
      ) : total === 0 ? (
        <p className="shopping-list__empty">Aucun ingrédient dans les recettes de ce menu.</p>
      ) : (
        <>
          <div className="shopping-list__progress">
            <div className="shopping-list__progress-bar">
              {/* Inline width: the only value computed at runtime */}
              <div className="shopping-list__progress-fill" style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="shopping-list__progress-label">{done} / {total}</span>
          </div>

          <div className="shopping-list__sections">
            {sections.map(section => (
              <section key={section.key} className="shopping-list__section">
                <h3 className="shopping-list__section-title">
                  {section.label}
                  <span className="shopping-list__section-count">{section.rows.length}</span>
                </h3>
                <ul className="shopping-list__items">
                  {section.rows.map(row => (
                    <li key={row.key}>
                      <label
                        className={`shopping-list__item ${checked.has(row.key) ? 'shopping-list__item--checked' : ''}`}
                        title={row.recipes.join(', ')}
                      >
                        <input
                          className="shopping-list__checkbox"
                          type="checkbox"
                          checked={checked.has(row.key)}
                          onChange={() => toggle(row.key)}
                        />
                        <span className="shopping-list__name">{row.name}</span>
                        {row.quantity && <span className="shopping-list__qty">{row.quantity}</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
