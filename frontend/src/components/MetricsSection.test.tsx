import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MetricsSection from './MetricsSection'
import type { PersonalMetrics } from '../types/profil'

function makeMetrics(overrides: Partial<PersonalMetrics> = {}): PersonalMetrics {
  return {
    gender: 'homme',
    age: 28,
    weight: 75,
    height: 178,
    bodyFatPercent: null,
    workActivity: 'sedentaire',
    weeklySessions: 3,
    ...overrides,
  }
}

function renderSection(overrides: Partial<React.ComponentProps<typeof MetricsSection>> = {}) {
  const onChange = vi.fn()
  const onRecalculate = vi.fn()
  const onSave = vi.fn()
  const props = {
    metrics: makeMetrics(),
    onChange,
    tdee: 2500,
    onRecalculate,
    isPersonnalise: false,
    saved: false,
    onSave,
    ...overrides,
  }
  render(<MetricsSection {...props} />)
  return { onChange, onRecalculate, onSave, props }
}

describe('MetricsSection', () => {
  it('displays the estimated TDEE with the Mifflin-St Jeor label by default', () => {
    renderSection({ tdee: 2203 })
    expect(screen.getByText(/2203 kcal \/ jour/)).toBeInTheDocument()
    expect(screen.getByText('(Mifflin-St Jeor)')).toBeInTheDocument()
  })

  it('switches the label to Katch-McArdle when a body fat % is set', () => {
    renderSection({
      metrics: makeMetrics({ bodyFatPercent: 18 }),
      tdee: 2400,
    })
    expect(screen.getByText('(Katch-McArdle)')).toBeInTheDocument()
  })

  it('shows a placeholder instead of a number when tdee is null', () => {
    renderSection({ tdee: null })
    expect(screen.getByText(/Remplis tes métriques/)).toBeInTheDocument()
    expect(screen.queryByText(/kcal \/ jour/)).not.toBeInTheDocument()
  })

  it('increments weekly sport sessions and reports the change via onChange', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSection({ metrics: makeMetrics({ weeklySessions: 3 }) })

    await user.click(screen.getByRole('button', { name: '+' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weeklySessions: 4 })
    )
  })

  it('decrements weekly sport sessions but never goes below 0', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSection({ metrics: makeMetrics({ weeklySessions: 0 }) })

    await user.click(screen.getByRole('button', { name: '−' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weeklySessions: 0 })
    )
  })

  it('caps weekly sport sessions at 14', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSection({ metrics: makeMetrics({ weeklySessions: 14 }) })

    await user.click(screen.getByRole('button', { name: '+' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weeklySessions: 14 })
    )
  })

  it('updates gender on click', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSection({ metrics: makeMetrics({ gender: 'homme' }) })

    await user.click(screen.getByRole('button', { name: /Femme/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ gender: 'femme' })
    )
  })

  it('shows the recalculate button when goals are not personalised, and calls onRecalculate', async () => {
    const user = userEvent.setup()
    const { onRecalculate } = renderSection({ isPersonnalise: false })

    const button = screen.getByRole('button', { name: /Recalculer/ })
    await user.click(button)

    expect(onRecalculate).toHaveBeenCalledTimes(1)
  })

  it('hides the recalculate button when goals are personalised', () => {
    renderSection({ isPersonnalise: true })
    expect(screen.queryByRole('button', { name: /Recalculer/ })).not.toBeInTheDocument()
  })

  it('calls onSave and reflects the saved state', async () => {
    const user = userEvent.setup()
    const { onSave } = renderSection({ saved: false })

    await user.click(screen.getByRole('button', { name: /Sauvegarder mes métriques/ }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows the saved confirmation label when saved is true', () => {
    renderSection({ saved: true })
    expect(screen.getByText(/Métriques sauvegardées/)).toBeInTheDocument()
  })
})
