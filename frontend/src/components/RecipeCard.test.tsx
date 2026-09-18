import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RecipeCard from './RecipeCard'
import { likeRecipe, unlikeRecipe } from '../services/api'
import type { RecipeListItem } from '../types/recipe'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  likeRecipe: vi.fn().mockResolvedValue(undefined),
  unlikeRecipe: vi.fn().mockResolvedValue(undefined),
}))

function makeRecipe(overrides: Partial<RecipeListItem> = {}): RecipeListItem {
  return {
    id: 42,
    title: 'Pâtes au poulet',
    source_platform: null,
    source_author: null,
    thumbnail_url: null,
    servings: 2,
    calories: 500,
    proteins_g: 40,
    carbs_g: 50,
    fats_g: 15,
    isLiked: false,
    likesCount: 3,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderCard(overrides: Partial<React.ComponentProps<typeof RecipeCard>> = {}) {
  const onLikeToggle = vi.fn()
  const props = {
    recipe: makeRecipe(),
    isLiked: false,
    onLikeToggle,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <RecipeCard {...props} />
    </MemoryRouter>
  )
  return { onLikeToggle, props }
}

beforeEach(() => {
  vi.mocked(likeRecipe).mockClear().mockResolvedValue(undefined)
  vi.mocked(unlikeRecipe).mockClear().mockResolvedValue(undefined)
  mockNavigate.mockClear()
})

describe('RecipeCard — like button', () => {
  it('shows an empty heart when the recipe is not liked', () => {
    renderCard({ isLiked: false })
    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toHaveTextContent('🤍')
  })

  it('shows a filled heart when the recipe is already liked', () => {
    renderCard({ isLiked: true })
    expect(screen.getByRole('button', { name: 'Retirer des favoris' })).toHaveTextContent('❤️')
  })

  it('likes the recipe optimistically and reports the toggle to the parent', async () => {
    const user = userEvent.setup()
    const { onLikeToggle, props } = renderCard({ isLiked: false })

    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }))

    expect(screen.getByRole('button', { name: 'Retirer des favoris' })).toHaveTextContent('❤️')
    expect(likeRecipe).toHaveBeenCalledWith(props.recipe.id)
    expect(unlikeRecipe).not.toHaveBeenCalled()
    expect(onLikeToggle).toHaveBeenCalledWith(props.recipe.id)
  })

  it('unlikes the recipe optimistically when it was already liked', async () => {
    const user = userEvent.setup()
    const { props } = renderCard({ isLiked: true })

    await user.click(screen.getByRole('button', { name: 'Retirer des favoris' }))

    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toHaveTextContent('🤍')
    expect(unlikeRecipe).toHaveBeenCalledWith(props.recipe.id)
    expect(likeRecipe).not.toHaveBeenCalled()
  })

  it('reverts the optimistic update when the like request fails', async () => {
    vi.mocked(likeRecipe).mockRejectedValueOnce(new Error('network error'))
    const user = userEvent.setup()
    renderCard({ isLiked: false })

    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toHaveTextContent('🤍')
    })
  })

  it('stops click propagation so liking a card does not navigate to the recipe detail', async () => {
    const user = userEvent.setup()
    renderCard({ isLiked: false })

    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to the recipe detail when the card itself is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderCard()

    await user.click(screen.getByText(props.recipe.title))

    expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${props.recipe.id}`)
  })
})
