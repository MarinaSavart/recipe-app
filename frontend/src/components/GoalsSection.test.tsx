import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalsSection from './GoalsSection'
import type { NutritionalGoals } from '../types/profil'

function makeGoals(overrides: Partial<NutritionalGoals> = {}): NutritionalGoals {
  return {
    goal: 'maintenance',
    mealsPerDay: 3,
    calories: 2400,
    proteinsG: 150,
    carbsG: 220,
    fatsG: 65,
    ...overrides,
  }
}

function renderSection(overrides: Partial<React.ComponentProps<typeof GoalsSection>> = {}) {
  const onChange = vi.fn()
  const onSave = vi.fn()
  const props = {
    goals: makeGoals(),
    onChange,
    saved: false,
    onSave,
    ...overrides,
  }
  render(<GoalsSection {...props} />)
  return { onChange, onSave, props }
}

describe('GoalsSection', () => {
  it('selects a regime and reports it via onChange', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSection()

    await user.click(screen.getByRole('button', { name: /Prise de masse/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 'masse' })
    )
  })

  it('switches the goal to personnalise when a macro is edited manually', () => {
    const { onChange } = renderSection({ goals: makeGoals({ goal: 'maintenance', calories: 2400 }) })

    const caloriesInput = screen
      .getByText('Calories / jour (kcal)')
      .closest('.profile__goal-field')!
      .querySelector('input')!
    fireEvent.change(caloriesInput, { target: { value: '2000' } })

    const lastCall = onChange.mock.calls.at(-1)![0]
    expect(lastCall.goal).toBe('personnalise')
    expect(lastCall.calories).toBe(2000)
  })

  it('increments meals per day up to a max of 6', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSection({ goals: makeGoals({ mealsPerDay: 6 }) })

    await user.click(screen.getByRole('button', { name: '+' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mealsPerDay: 6 })
    )
  })

  it('decrements meals per day down to a min of 1', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSection({ goals: makeGoals({ mealsPerDay: 1 }) })

    await user.click(screen.getByRole('button', { name: '−' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mealsPerDay: 1 })
    )
  })

  it('computes the per-meal macro split from the daily goals', () => {
    renderSection({
      goals: makeGoals({ calories: 2400, proteinsG: 150, carbsG: 220, fatsG: 65, mealsPerDay: 4 }),
    })

    expect(screen.getByText('600')).toBeInTheDocument() // 2400 / 4, no unit
    expect(screen.getByText('38g')).toBeInTheDocument() // round(150 / 4)
    expect(screen.getByText('55g')).toBeInTheDocument() // 220 / 4
    expect(screen.getByText('16g')).toBeInTheDocument() // round(65 / 4)
  })

  it('calls onSave when the save button is clicked, and reflects the saved state', async () => {
    const user = userEvent.setup()
    const { onSave } = renderSection({ saved: false })

    await user.click(screen.getByRole('button', { name: /Sauvegarder mes objectifs/ }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows the saved confirmation label when saved is true', () => {
    renderSection({ saved: true })
    expect(screen.getByText(/^✅ Sauvegardé/)).toBeInTheDocument()
  })
})
