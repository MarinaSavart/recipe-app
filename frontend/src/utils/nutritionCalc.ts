import type { NutritionalGoals, PersonalMetrics } from "../types/profil"

/**
 * Returns the activity multiplier used in the TDEE formula, combining
 * the base multiplier for the work activity level with a bonus based
 * on the number of weekly sport sessions.
 *
 * @param workActivity - Work activity level key (e.g. "sedentaire", "actif")
 * @param weeklySessions - Number of sport sessions per week (capped at 14)
 * @returns The multiplier to apply to the BMR
 */
export function getActivityMultiplier(workActivity: string, weeklySessions: number): number {
  const base: Record<string, number> = {
    sedentaire: 1.2,
    leger: 1.375,
    actif: 1.55,
    tres_actif: 1.725,
  }
  const sportBonus = Math.min(weeklySessions, 14) * 0.025
  return (base[workActivity] ?? 1.2) + sportBonus
}

/**
 * Calculates the Total Daily Energy Expenditure (TDEE) from personal metrics.
 * Uses the Katch-McArdle formula when body fat percentage is known,
 * otherwise falls back to Mifflin-St Jeor.
 *
 * @param metrics - The user's personal metrics
 * @returns The estimated TDEE in kcal/day, or null if required metrics are missing
 */
export function calculateTDEE(metrics: PersonalMetrics): number | null {
  if (!metrics.gender || !metrics.age || !metrics.weight || !metrics.height) return null

  let bmr: number

  if (metrics.bodyFatPercent !== null) {
    const lbm = metrics.weight * (1 - metrics.bodyFatPercent / 100)
    bmr = 370 + 21.6 * lbm
  } else {
    bmr =
      metrics.gender === 'homme'
        ? 10 * metrics.weight + 6.25 * metrics.height - 5 * metrics.age + 5
        : 10 * metrics.weight + 6.25 * metrics.height - 5 * metrics.age - 161
  }

  return Math.round(bmr * getActivityMultiplier(metrics.workActivity, metrics.weeklySessions))
}

/**
 * Computes daily calorie and macronutrient targets for a given goal.
 *
 * @param tdee - The user's Total Daily Energy Expenditure in kcal/day
 * @param goal - The nutritional goal ("maintenance", "seche", "masse", or any other value for the default profile)
 * @param weight - The user's weight in kg, used to scale protein/fat/carb targets
 * @returns Daily calorie and macronutrient targets (calories, proteinsG, carbsG, fatsG)
 */
export function calculateMacros(
  tdee: number,
  goal: string,
  weight: number
): Omit<NutritionalGoals, 'goal' | 'mealsPerDay'> {
  let calories: number
  let proteinsG: number
  let carbsG: number
  let fatsG: number

  switch (goal) {
    case 'maintenance':
      calories = tdee
      proteinsG = Math.round(weight * 1.8)
      carbsG = Math.round(weight * 4.0)
      fatsG = Math.round((calories - proteinsG * 4 - carbsG * 4) / 9)
      if (fatsG < weight * 1.0) {
        fatsG = Math.round(weight * 1.0)
        carbsG = Math.round((calories - proteinsG * 4 - fatsG * 9) / 4)
      }
      break

    case 'seche':
      calories = Math.max(1200, Math.round(tdee * 0.82))
      proteinsG = Math.round(weight * 1.8)
      carbsG = Math.round(weight * 3.0)
      fatsG = Math.round((calories - proteinsG * 4 - carbsG * 4) / 9)
      if (fatsG < weight * 0.8) {
        fatsG = Math.round(weight * 0.8)
        carbsG = Math.round((calories - proteinsG * 4 - fatsG * 9) / 4)
      }
      break

    case 'masse':
      calories = tdee + 300
      proteinsG = Math.round(weight * 2.0)
      carbsG = Math.round(weight * 5.0)
      fatsG = Math.round((calories - proteinsG * 4 - carbsG * 4) / 9)
      if (fatsG < weight * 1.0) {
        fatsG = Math.round(weight * 1.0)
        carbsG = Math.round((calories - proteinsG * 4 - fatsG * 9) / 4)
      }
      if (fatsG > (calories * 0.3) / 9) {
        fatsG = Math.round((calories * 0.3) / 9)
        carbsG = Math.round((calories - proteinsG * 4 - fatsG * 9) / 4)
      }
      break

    default:
      calories = tdee
      proteinsG = Math.round(weight * 1.8)
      carbsG = Math.round(weight * 4.0)
      fatsG = Math.round((calories - proteinsG * 4 - carbsG * 4) / 9)
      if (fatsG < weight * 1.0) {
        fatsG = Math.round(weight * 1.0)
        carbsG = Math.round((calories - proteinsG * 4 - fatsG * 9) / 4)
      }
  }

  return {
    calories,
    proteinsG: Math.max(0, proteinsG),
    carbsG: Math.max(0, carbsG),
    fatsG: Math.max(0, fatsG),
  }
}
