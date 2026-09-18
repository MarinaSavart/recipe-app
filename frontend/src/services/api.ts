import type { Recipe, RecipeListItem, UpdateRecipePayload } from "../types/recipe"

// Le backend renvoie is_liked / likes_count en snake_case (comme le reste du JSON) ;
// on les convertit ici en isLiked / likesCount pour respecter la convention camelCase
// des objets internes au frontend.
type RawRecipe = Omit<Recipe, 'isLiked' | 'likesCount'> & { is_liked: boolean; likes_count: number }
type RawRecipeListItem = Omit<RecipeListItem, 'isLiked' | 'likesCount'> & { is_liked: boolean; likes_count: number }

function mapRecipe(raw: RawRecipe): Recipe {
    const { is_liked, likes_count, ...rest } = raw
    return { ...rest, isLiked: is_liked, likesCount: likes_count }
}

function mapRecipeListItem(raw: RawRecipeListItem): RecipeListItem {
    const { is_liked, likes_count, ...rest } = raw
    return { ...rest, isLiked: is_liked, likesCount: likes_count }
}

interface AuthResponse {
    access_token: string
    user: {
        id: number
        email: string
        name: string | null
        avatar_url: string | null
    }
}

const BASE_URL = import.meta.env.VITE_API_URL

function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
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

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    })
}

// ── Recipes ────────────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<RecipeListItem[]> {
    const raw = await request<RawRecipeListItem[]>('/recipes/')
    return raw.map(mapRecipeListItem)
}

export async function getRecipe(id: number): Promise<Recipe> {
    const raw = await request<RawRecipe>(`/recipes/${id}/`)
    return mapRecipe(raw)
}

export async function getLikedRecipes(): Promise<RecipeListItem[]> {
    const raw = await request<RawRecipeListItem[]>('/recipes/liked')
    return raw.map(mapRecipeListItem)
}

export async function likeRecipe(id: number): Promise<void> {
  await request<void>(`/recipes/${id}/like`, { method: 'POST' })
}

export async function unlikeRecipe(id: number): Promise<void> {
  await request<void>(`/recipes/${id}/like`, { method: 'DELETE' })
}

export async function importFromUrl(url: string): Promise<Recipe> {
  const raw = await request<RawRecipe>('/recipes/import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  return mapRecipe(raw)
}

export async function importManual(description: string, sourceUrl?: string): Promise<Recipe> {
  const raw = await request<RawRecipe>('/recipes/import/manual', {
    method: 'POST',
    body: JSON.stringify({
      description,
      source_url: sourceUrl,
    }),
  })
  return mapRecipe(raw)
}

export async function deleteRecipe(id: number): Promise<void> {
  return request<void>(`/recipes/${id}`, {
    method: 'DELETE',
  })
}

export async function updateRecipe(id: number, data: Partial<UpdateRecipePayload>): Promise<Recipe> {
  const raw = await request<RawRecipe>(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return mapRecipe(raw)
}

export async function uploadPhoto(id: number, file: File): Promise<Recipe> {
  const formData = new FormData()
  formData.append('file', file)
  // On n'utilise pas le helper request() car pas de Content-Type JSON ici
  const res = await fetch(`${BASE_URL}/recipes/${id}/photo`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Erreur inconnue' }))
    throw new Error(error.detail ?? 'Erreur inconnue')
  }
  const raw: RawRecipe = await res.json()
  return mapRecipe(raw)
}