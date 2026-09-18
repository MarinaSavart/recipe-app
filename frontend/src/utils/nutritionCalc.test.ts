import { describe, it, expect } from 'vitest'
import { calculateMacros, calculateTDEE, getActivityMultiplier } from './nutritionCalc'
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

describe('getActivityMultiplier', () => {
  it('returns the base multiplier for each work activity with no sport sessions', () => {
    expect(getActivityMultiplier('sedentaire', 0)).toBeCloseTo(1.2)
    expect(getActivityMultiplier('leger', 0)).toBeCloseTo(1.375)
    expect(getActivityMultiplier('actif', 0)).toBeCloseTo(1.55)
    expect(getActivityMultiplier('tres_actif', 0)).toBeCloseTo(1.725)
  })

  it('falls back to the sedentaire base for an unknown work activity', () => {
    expect(getActivityMultiplier('inconnu', 0)).toBeCloseTo(1.2)
  })

  it('adds 0.025 per weekly sport session', () => {
    expect(getActivityMultiplier('sedentaire', 1)).toBeCloseTo(1.225)
    expect(getActivityMultiplier('sedentaire', 3)).toBeCloseTo(1.275)
  })

  it('keeps increasing the bonus up to the max of 14 sessions/week', () => {
    // Regression test: the sport bonus used to be capped at 6 sessions even
    // though the UI allows selecting up to 14, so the TDEE stopped updating
    // past 6 sessions.
    expect(getActivityMultiplier('sedentaire', 7)).toBeGreaterThan(
      getActivityMultiplier('sedentaire', 6)
    )
    expect(getActivityMultiplier('sedentaire', 14)).toBeCloseTo(1.2 + 14 * 0.025)
  })

  it('does not increase the bonus past 14 sessions', () => {
    expect(getActivityMultiplier('sedentaire', 20)).toBeCloseTo(
      getActivityMultiplier('sedentaire', 14)
    )
  })
})

describe('calculateTDEE', () => {
  it('returns null when a required metric is missing', () => {
    expect(calculateTDEE(makeMetrics({ gender: '' }))).toBeNull()
    expect(calculateTDEE(makeMetrics({ age: 0 }))).toBeNull()
    expect(calculateTDEE(makeMetrics({ weight: 0 }))).toBeNull()
    expect(calculateTDEE(makeMetrics({ height: 0 }))).toBeNull()
  })

  it('uses the Mifflin-St Jeor formula for men when no body fat % is given', () => {
    const metrics = makeMetrics({ gender: 'homme', weight: 75, height: 178, age: 28 })
    const bmr = 10 * 75 + 6.25 * 178 - 5 * 28 + 5
    const expected = Math.round(bmr * getActivityMultiplier('sedentaire', 3))
    expect(calculateTDEE(metrics)).toBe(expected)
  })

  it('uses the Mifflin-St Jeor formula for women when no body fat % is given', () => {
    const metrics = makeMetrics({ gender: 'femme', weight: 60, height: 165, age: 30 })
    const bmr = 10 * 60 + 6.25 * 165 - 5 * 30 - 161
    const expected = Math.round(bmr * getActivityMultiplier('sedentaire', 3))
    expect(calculateTDEE(metrics)).toBe(expected)
  })

  it('uses the Katch-McArdle formula when body fat % is provided', () => {
    const metrics = makeMetrics({ weight: 75, bodyFatPercent: 20 })
    const lbm = 75 * (1 - 20 / 100)
    const bmr = 370 + 21.6 * lbm
    const expected = Math.round(bmr * getActivityMultiplier('sedentaire', 3))
    expect(calculateTDEE(metrics)).toBe(expected)
  })

  it('increases as weekly sport sessions increase, across the full 0-14 range', () => {
    const results = Array.from({ length: 15 }, (_, sessions) =>
      calculateTDEE(makeMetrics({ weeklySessions: sessions }))
    )
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!).toBeGreaterThan(results[i - 1]!)
    }
  })
})

describe('calculateMacros', () => {
  const tdee = 2500
  const weight = 75

  it('maintenance: calories equal TDEE', () => {
    const macros = calculateMacros(tdee, 'maintenance', weight)
    expect(macros.calories).toBe(tdee)
    expect(macros.proteinsG).toBe(Math.round(weight * 1.8))
  })

  it('seche: calories are reduced below TDEE with a 1200 kcal floor', () => {
    const macros = calculateMacros(tdee, 'seche', weight)
    expect(macros.calories).toBe(Math.round(tdee * 0.82))
    expect(macros.calories).toBeLessThan(tdee)

    const lowTdee = calculateMacros(1000, 'seche', weight)
    expect(lowTdee.calories).toBe(1200)
  })

  it('masse: calories are increased above TDEE by 300 kcal', () => {
    const macros = calculateMacros(tdee, 'masse', weight)
    expect(macros.calories).toBe(tdee + 300)
  })

  it('never returns negative macros', () => {
    const macros = calculateMacros(100, 'seche', 200)
    expect(macros.proteinsG).toBeGreaterThanOrEqual(0)
    expect(macros.carbsG).toBeGreaterThanOrEqual(0)
    expect(macros.fatsG).toBeGreaterThanOrEqual(0)
  })

  it('falls back to the maintenance split for an unknown goal', () => {
    const known = calculateMacros(tdee, 'maintenance', weight)
    const unknown = calculateMacros(tdee, 'un_objectif_inconnu', weight)
    expect(unknown).toEqual(known)
  })
})
