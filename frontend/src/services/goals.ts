import { DEFAULT_GOALS, type NutritionalGoals, type SyncedNutritionalGoals } from '../types/profil'
import { getUserGoals, saveUserGoals } from './api'

/** localStorage key holding a user's nutritional goals. */
function goalsKey(userId: number): string {
  return `nutritional_goals_${userId}`
}

/**
 * Reads the goals saved in localStorage, migrating the old key format if needed.
 *
 * @returns The stored goals, or null if nothing (valid) is stored
 */
export function readStoredGoals(userId: number): NutritionalGoals | null {
  const stored = localStorage.getItem(goalsKey(userId))
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored)

    // Migration: old format → new format
    return {
      goal: parsed.goal ?? parsed.regime ?? 'maintenance',
      mealsPerDay: parsed.mealsPerDay ?? parsed.meals_per_day ?? 3,
      calories: parsed.calories ?? 2000,
      proteinsG: parsed.proteinsG ?? parsed.proteins_g ?? 150,
      carbsG: parsed.carbsG ?? parsed.carbs_g ?? 220,
      fatsG: parsed.fatsG ?? parsed.fats_g ?? 65,
    }
  } catch {
    return null
  }
}

/** Keeps only the part of the goals synced with the backend (drops the local preset). */
function toSynced(goals: NutritionalGoals): SyncedNutritionalGoals {
  return {
    calories: goals.calories,
    proteinsG: goals.proteinsG,
    carbsG: goals.carbsG,
    fatsG: goals.fatsG,
    mealsPerDay: goals.mealsPerDay,
  }
}

/** Saves the goals both in localStorage and on the backend (used for menu generation). */
export async function saveGoals(userId: number, goals: NutritionalGoals): Promise<void> {
  localStorage.setItem(goalsKey(userId), JSON.stringify(goals))
  await saveUserGoals(toSynced(goals))
}

/**
 * Resolves the user's goals, identically on every page.
 * The backend is the source of truth; the preset (`goal`) only lives locally.
 * Goals that only exist in localStorage (saved before the backend sync existed)
 * are pushed to the backend, so menu generation uses them too.
 */
export async function loadGoals(userId: number): Promise<NutritionalGoals> {
  const local = readStoredGoals(userId)
  const remote = await getUserGoals()

  if (remote) return { ...(local ?? DEFAULT_GOALS), ...remote }

  if (local) await saveUserGoals(toSynced(local))
  return local ?? DEFAULT_GOALS
}
