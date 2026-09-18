import type { Recipe, RecipeListItem, UpdateRecipePayload } from "../types/recipe"

// The backend returns is_liked / likes_count in snake_case (like the rest of the JSON);
// we convert them here to isLiked / likesCount to follow the camelCase convention
// used by internal frontend objects.
type RawRecipe = Omit<Recipe, 'isLiked' | 'likesCount'> & { is_liked: boolean; likes_count: number }
type RawRecipeListItem = Omit<RecipeListItem, 'isLiked' | 'likesCount'> & { is_liked: boolean; likes_count: number }

/** Converts a raw API recipe (snake_case flags) into the frontend's Recipe shape (camelCase). */
function mapRecipe(raw: RawRecipe): Recipe {
    const { is_liked, likes_count, ...rest } = raw
    return { ...rest, isLiked: is_liked, likesCount: likes_count }
}

/** Converts a raw API recipe list item (snake_case flags) into the frontend's RecipeListItem shape (camelCase). */
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

/** Builds the Authorization header from the token stored in localStorage, if any. */
function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Performs an authenticated JSON request against the backend API.
 * On a 401, clears the stored session and redirects to /login. On a 403,
 * throws a generic "not authorized" error. On other non-OK responses,
 * throws an error built from the backend's error detail when available.
 *
 * @param path - The API path, relative to the base URL (e.g. "/recipes/")
 * @param options - Extra fetch options (method, body, etc.)
 * @returns The parsed JSON response, or null for a 204 No Content
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
        },
        ...options,
    })

    if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        throw new Error('Session expirée — veuillez vous reconnecter')
    }

    if (res.status === 403) {
        throw new Error('Action non autorisée')
    }

    if (!res.ok) {
        // Try to retrieve the error message from the backend
        const error = await res.json().catch(() => ({ detail: 'Erreur inconnue' }))
        throw new Error(error.detail ?? 'Erreur inconnue')
    }

    // 204 No Content (delete) -> no body to parse
    if (res.status === 204) return null as T

    return res.json()

}

// ── Auth ───────────────────────────────────────────────────────────────────────

/** Logs a user in and returns the access token along with their profile. */
export async function login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
}

/** Creates a new user account and returns the access token along with their profile. */
export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    })
}

// ── Recipes ────────────────────────────────────────────────────────────────────

/** Fetches the lightweight list of all recipes. */
export async function getRecipes(): Promise<RecipeListItem[]> {
    const raw = await request<RawRecipeListItem[]>('/recipes/')
    return raw.map(mapRecipeListItem)
}

/** Fetches a single recipe with its full details (ingredients, steps, tags). */
export async function getRecipe(id: number): Promise<Recipe> {
    const raw = await request<RawRecipe>(`/recipes/${id}/`)
    return mapRecipe(raw)
}

/** Fetches the lightweight list of recipes liked by the current user. */
export async function getLikedRecipes(): Promise<RecipeListItem[]> {
    const raw = await request<RawRecipeListItem[]>('/recipes/liked')
    return raw.map(mapRecipeListItem)
}

/** Fetches the lightweight list of recipes imported by the current user, most recent first. */
export async function getMyRecipes(): Promise<RecipeListItem[]> {
    const raw = await request<RawRecipeListItem[]>('/recipes/mine')
    return raw.map(mapRecipeListItem)
}

/** Likes a recipe for the current user. */
export async function likeRecipe(id: number): Promise<void> {
  await request<void>(`/recipes/${id}/like`, { method: 'POST' })
}

/** Removes the current user's like from a recipe. */
export async function unlikeRecipe(id: number): Promise<void> {
  await request<void>(`/recipes/${id}/like`, { method: 'DELETE' })
}

/** Imports a recipe automatically from an Instagram or TikTok URL. */
export async function importFromUrl(url: string): Promise<Recipe> {
  const raw = await request<RawRecipe>('/recipes/import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  return mapRecipe(raw)
}

/** Imports a recipe from a manually pasted description, with an optional source URL. */
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

/** Deletes a recipe (owner only). */
export async function deleteRecipe(id: number): Promise<void> {
  return request<void>(`/recipes/${id}`, {
    method: 'DELETE',
  })
}

/** Updates a recipe with the given partial payload (owner only). */
export async function updateRecipe(id: number, data: Partial<UpdateRecipePayload>): Promise<Recipe> {
  const raw = await request<RawRecipe>(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return mapRecipe(raw)
}

/** Uploads a new photo for a recipe (owner only) and returns the updated recipe. */
export async function uploadPhoto(id: number, file: File): Promise<Recipe> {
  const formData = new FormData()
  formData.append('file', file)
  // We don't use the request() helper here since there's no JSON Content-Type
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
