import type { Recipe, RecipeListItem } from "../types/recipe"

const BASE_URL = import.meta.env.VITE_API_URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    })

    if (!res.ok) {
        // On essaie de récupérer le message d'erreur du backend
        const error = await res.json().catch(() => ({ detail: 'Erreur inconnue' }))
        throw new Error(error.detail ?? 'Erreur inconnue')
    }

    // 204 No Content (delete) -> pas de body à parser
    if (res.status === 204) return null as T

    return res.json()
  
}

// ── Recipes ────────────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<RecipeListItem[]> {
    return request<RecipeListItem[]>('/recipes/')
}

export async function getRecipe(id: number): Promise<Recipe> {
    return request<Recipe>(`/recipes/${id}/`)
}

export async function importFromUrl(url: string): Promise<Recipe> {
  return request<Recipe>('/recipes/import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export async function importManual(description: string, sourceUrl?: string): Promise<Recipe> {
  return request<Recipe>('/recipes/import/manual', {
    method: 'POST',
    body: JSON.stringify({
      description,
      source_url: sourceUrl,
    }),
  })
}

export async function deleteRecipe(id: number): Promise<void> {
  return request<void>(`/recipes/${id}`, {
    method: 'DELETE',
  })
}

export async function updateRecipe(id: number, data: Partial<{
  title: string
  description: string | null
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  calories: number | null
  proteinsG: number | null
  carbsG: number | null
  fatsG: number | null
  ingredients: { name: string; quantity: string | null; unit: string | null; notes: string | null; position: number }[]
  steps: { content: string; position: number; duration_minutes: number | null }[]
  tags: string[]
}>): Promise<Recipe> {
  return request<Recipe>(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function uploadPhoto(id: number, file: File): Promise<Recipe> {
  const formData = new FormData()
  formData.append('file', file)
  // On n'utilise pas le helper request() car pas de Content-Type JSON ici
  const res = await fetch(`${BASE_URL}/recipes/${id}/photo`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Erreur inconnue' }))
    throw new Error(error.detail ?? 'Erreur inconnue')
  }
  return res.json()
}