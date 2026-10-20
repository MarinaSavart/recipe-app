import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { CiqualFood } from '../types/recipe'
import { aisleLabel } from '../utils/shoppingList'

// Wait for a pause in typing before searching
const SEARCH_DELAY_MS = 250
const MIN_QUERY_LENGTH = 2

interface IngredientNameInputProps {
  value: string
  /** The Ciqual food linked to the ingredient, if any. */
  link: CiqualFood | null
  /** Called on typing; the parent drops the link, which belongs to the previous name. */
  onChange: (name: string) => void
  onLinkChange: (food: CiqualFood | null) => void
  /** Searches Ciqual foods for the typed name (injected by the page, which owns the API calls). */
  search: (query: string) => Promise<CiqualFood[]>
  className?: string
}

/**
 * Ingredient name field with Ciqual suggestions while typing (combobox): picking one
 * links the ingredient to that food. Below, the current link or a "not linked" warning.
 */
export default function IngredientNameInput({ value, link, onChange, onLinkChange, search, className = '' }: IngredientNameInputProps) {
  const listId = useId()
  const [suggestions, setSuggestions] = useState<CiqualFood[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Only the latest search may update the list (earlier ones can answer later)
  const latestRequest = useRef(0)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function scheduleSearch(query: string) {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setOpen(false)
      setSuggestions([])
      return
    }
    timer.current = setTimeout(() => {
      const request = ++latestRequest.current
      search(query.trim())
        .then(foods => {
          if (request !== latestRequest.current) return
          setSuggestions(foods)
          setActive(-1)
          setOpen(foods.length > 0)
        })
        .catch(() => setOpen(false))
    }, SEARCH_DELAY_MS)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
    scheduleSearch(e.target.value)
  }

  function select(food: CiqualFood) {
    onLinkChange(food)
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      select(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={`ingredient-search ${className}`}>
      <input
        className="edit-field__input ingredient-search__input"
        placeholder="Nom"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(suggestions.length > 0 && !link)}
        onBlur={() => setOpen(false)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      />

      {open && (
        <ul id={listId} className="ingredient-search__list" role="listbox">
          {suggestions.map((food, i) => (
            <li
              key={food.code}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`ingredient-search__option ${i === active ? 'ingredient-search__option--active' : ''}`}
              // mousedown (not click) so the choice happens before the input's blur closes the list
              onMouseDown={e => {
                e.preventDefault()
                select(food)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="ingredient-search__option-name">{food.name_fr}</span>
              <span className="ingredient-search__option-aisle">{aisleLabel(food.aisle)}</span>
            </li>
          ))}
        </ul>
      )}

      {link ? (
        <div className="ingredient-search__status ingredient-search__status--linked">
          <span className="ingredient-search__status-text" title={link.name_fr}>✓ {link.name_fr}</span>
          <button
            type="button"
            className="ingredient-search__unlink"
            onClick={() => onLinkChange(null)}
            aria-label="Retirer le lien Ciqual"
            title="Retirer le lien"
          >
            ×
          </button>
        </div>
      ) : value.trim() && (
        <div className="ingredient-search__status ingredient-search__status--unlinked">
          ⚠ Non relié à un aliment Ciqual
        </div>
      )}
    </div>
  )
}
