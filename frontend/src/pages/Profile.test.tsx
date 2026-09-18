import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Profile from './Profile'
import { AuthProvider } from '../context/AuthContext'
import { calculateMacros, calculateTDEE } from '../utils/nutritionCalc'

vi.mock('../services/api', () => ({
  getRecipes: vi.fn().mockResolvedValue([]),
}))

function renderProfile() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Profile />
      </AuthProvider>
    </MemoryRouter>
  )
}

function caloriesInput() {
  return screen
    .getByText('Calories / jour (kcal)')
    .closest('.profile__goal-field')!
    .querySelector('input') as HTMLInputElement
}

beforeEach(() => {
  localStorage.clear()
})

describe('Profile', () => {
  it('shows the metrics placeholder and default goals when nothing is saved yet', () => {
    renderProfile()

    expect(screen.getByText(/Remplis tes métriques/)).toBeInTheDocument()
    expect(caloriesInput().value).toBe('2000')
  })

  it('migrates legacy French-named metrics from localStorage into the new camelCase shape', () => {
    localStorage.setItem(
      'personal_metrics',
      JSON.stringify({
        sexe: 'femme',
        age: 30,
        poids: 60,
        taille: 165,
        masse_grasse: null,
        activite_pro: 'actif',
        seances_sport: 4,
      })
    )

    renderProfile()

    const expectedTdee = calculateTDEE({
      gender: 'femme',
      age: 30,
      weight: 60,
      height: 165,
      bodyFatPercent: null,
      workActivity: 'actif',
      weeklySessions: 4,
    })

    expect(screen.getByText(new RegExp(`${expectedTdee} kcal / jour`))).toBeInTheDocument()
  })

  // Regression test for a real migration gap found while writing this suite:
  // before the camelCase rename, sessions were stored as `weeklysessions`
  // (no underscore). The migration in Profile.tsx only falls back to
  // `seances_sport`, so pre-existing users lose their saved session count
  // and silently get reset to the default of 3.
  it('migrates the pre-rename "weeklysessions" field so saved session counts are not lost', () => {
    localStorage.setItem(
      'personal_metrics',
      JSON.stringify({
        gender: 'homme',
        age: 28,
        weight: 75,
        height: 178,
        bodyFatPercent: null,
        workactivity: 'actif',
        weeklysessions: 5,
      })
    )

    renderProfile()

    const expectedTdee = calculateTDEE({
      gender: 'homme',
      age: 28,
      weight: 75,
      height: 178,
      bodyFatPercent: null,
      workActivity: 'actif',
      weeklySessions: 5,
    })

    expect(screen.getByText(new RegExp(`${expectedTdee} kcal / jour`))).toBeInTheDocument()
  })

  it('recalculates the daily macros automatically when metrics change and the goal is not personnalise', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'personal_metrics',
      JSON.stringify({
        gender: 'homme',
        age: 28,
        weight: 75,
        height: 178,
        bodyFatPercent: null,
        workActivity: 'sedentaire',
        weeklySessions: 3,
      })
    )
    renderProfile()

    const before = caloriesInput().value

    // Increment weekly sport sessions -> TDEE goes up -> maintenance calories should follow.
    const plusButtons = screen.getAllByRole('button', { name: '+' })
    await user.click(plusButtons[0]!) // first '+' on the page belongs to MetricsSection

    await waitFor(() => {
      expect(caloriesInput().value).not.toBe(before)
    })

    const nextTdee = calculateTDEE({
      gender: 'homme',
      age: 28,
      weight: 75,
      height: 178,
      bodyFatPercent: null,
      workActivity: 'sedentaire',
      weeklySessions: 4,
    })!
    const expectedMacros = calculateMacros(nextTdee, 'maintenance', 75)
    expect(Number(caloriesInput().value)).toBe(expectedMacros.calories)
  })

  it('does not overwrite manually edited macros once the goal is personnalise', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'personal_metrics',
      JSON.stringify({
        gender: 'homme',
        age: 28,
        weight: 75,
        height: 178,
        bodyFatPercent: null,
        workActivity: 'sedentaire',
        weeklySessions: 3,
      })
    )
    renderProfile()

    await user.clear(caloriesInput())
    await user.type(caloriesInput(), '1800')
    expect(caloriesInput().value).toBe('1800')

    const plusButtons = screen.getAllByRole('button', { name: '+' })
    await user.click(plusButtons[0]!)

    // Metrics changed (TDEE moved) but the manually-set calories must be preserved.
    expect(caloriesInput().value).toBe('1800')
  })

  it('saves metrics to localStorage and shows a confirmation', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByRole('button', { name: /Sauvegarder mes métriques/ }))

    expect(screen.getByText(/Métriques sauvegardées/)).toBeInTheDocument()
    expect(localStorage.getItem('personal_metrics')).not.toBeNull()
  })

  it('saves goals to localStorage and shows a confirmation', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByRole('button', { name: /Sauvegarder mes objectifs/ }))

    expect(screen.getByText(/^✅ Sauvegardé/)).toBeInTheDocument()
    expect(localStorage.getItem('nutritional_goals')).not.toBeNull()
  })
})
