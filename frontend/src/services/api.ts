import type { Recipe, RecipeListItem, UpdateRecipePayload } from "../types/recipe"
import type { Menu, MenuGenerateParams, MenuItem, MenuListItem } from "../types/menu"
import { DEFAULT_GOALS, type SyncedNutritionalGoals } from "../types/profil"

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

/** Fetches the lightweight list of all recipes, optionally filtered by category. */
export async function getRecipes(category?: string): Promise<RecipeListItem[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : ''
    const raw = await request<RawRecipeListItem[]>(`/recipes/${params}`)
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

/** Imports a recipe automatically from an Instagram or TikTok URL, with an optional category override. */
export async function importFromUrl(url: string, category?: string): Promise<Recipe> {
  const raw = await request<RawRecipe>('/recipes/import', {
    method: 'POST',
    body: JSON.stringify({ url, category }),
  })
  return mapRecipe(raw)
}

/** Imports a recipe from a manually pasted description, with an optional source URL and category override. */
export async function importManual(description: string, sourceUrl?: string, category?: string): Promise<Recipe> {
  const raw = await request<RawRecipe>('/recipes/import/manual', {
    method: 'POST',
    body: JSON.stringify({
      description,
      source_url: sourceUrl,
      category,
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

// ── Menus ──────────────────────────────────────────────────────────────────────

// Menus are internal frontend objects: their snake_case API fields are mapped to camelCase.
interface RawMenuItem {
  id: number
  portions: number
  position: number
  recipe: RawRecipeListItem | null
}

interface RawMenu {
  id: number
  name: string
  meals_count: number
  created_at: string
  updated_at: string
  items: RawMenuItem[]
}

interface RawMenuListItem {
  id: number
  name: string
  meals_count: number
  recipes_count: number
  created_at: string
}

/** Converts a raw API menu item into the frontend's MenuItem shape. */
function mapMenuItem(raw: RawMenuItem): MenuItem {
  return {
    id: raw.id,
    portions: raw.portions,
    position: raw.position,
    recipe: raw.recipe ? mapRecipeListItem(raw.recipe) : null,
  }
}

/** Converts a raw API menu into the frontend's Menu shape. */
function mapMenu(raw: RawMenu): Menu {
  return {
    id: raw.id,
    name: raw.name,
    mealsCount: raw.meals_count,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    items: raw.items.map(mapMenuItem),
  }
}

/** Fetches the current user's menus, most recent first. */
export async function getMenus(): Promise<MenuListItem[]> {
  const raw = await request<RawMenuListItem[]>('/menus/')
  return raw.map(m => ({
    id: m.id,
    name: m.name,
    mealsCount: m.meals_count,
    recipesCount: m.recipes_count,
    createdAt: m.created_at,
  }))
}

/** Asks the backend (Ollama) to generate and save a menu covering the given number of meals. */
export async function generateMenu(params: MenuGenerateParams): Promise<Menu> {
  const raw = await request<RawMenu>('/menus/generate', {
    method: 'POST',
    body: JSON.stringify({ name: params.name, meals_count: params.mealsCount }),
  })
  return mapMenu(raw)
}

/** Fetches a full menu with its recipes. */
export async function getMenu(id: number): Promise<Menu> {
  return mapMenu(await request<RawMenu>(`/menus/${id}`))
}

/** Renames a menu. */
export async function updateMenu(id: number, data: { name: string }): Promise<Menu> {
  const raw = await request<RawMenu>(`/menus/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return mapMenu(raw)
}

/** Deletes a menu. */
export async function deleteMenu(id: number): Promise<void> {
  await request<void>(`/menus/${id}`, { method: 'DELETE' })
}

/** Adds a recipe to a menu (covering one batch of its portions) and returns the updated menu. */
export async function addMenuItem(menuId: number, recipeId: number): Promise<Menu> {
  const raw = await request<RawMenu>(`/menus/${menuId}/items`, {
    method: 'POST',
    body: JSON.stringify({ recipe_id: recipeId }),
  })
  return mapMenu(raw)
}

/**
 * Replaces a recipe of a menu, or changes its portions (same recipe, new count),
 * and returns the updated menu. Without `portions`, the recipe's own servings are used.
 */
export async function updateMenuItem(menuId: number, itemId: number, recipeId: number, portions?: number): Promise<Menu> {
  const raw = await request<RawMenu>(`/menus/${menuId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ recipe_id: recipeId, portions }),
  })
  return mapMenu(raw)
}

/** Removes a recipe from a menu. */
export async function deleteMenuItem(menuId: number, itemId: number): Promise<void> {
  await request<void>(`/menus/${menuId}/items/${itemId}`, { method: 'DELETE' })
}

// ── User goals ─────────────────────────────────────────────────────────────────

interface RawUserGoals {
  calories: number | null
  proteins_g: number | null
  carbs_g: number | null
  fats_g: number | null
  meals_per_day: number
}

/** Fetches the user's nutritional goals saved on the backend, or null if none were saved yet. */
export async function getUserGoals(): Promise<SyncedNutritionalGoals | null> {
  const raw = await request<RawUserGoals | null>('/users/me/goals')
  if (!raw) return null
  return {
    calories: raw.calories ?? DEFAULT_GOALS.calories,
    proteinsG: raw.proteins_g ?? DEFAULT_GOALS.proteinsG,
    carbsG: raw.carbs_g ?? DEFAULT_GOALS.carbsG,
    fatsG: raw.fats_g ?? DEFAULT_GOALS.fatsG,
    mealsPerDay: raw.meals_per_day,
  }
}

/** Saves the user's nutritional goals on the backend (used for menu generation). */
export async function saveUserGoals(goals: SyncedNutritionalGoals): Promise<void> {
  await request<RawUserGoals>('/users/me/goals', {
    method: 'PUT',
    body: JSON.stringify({
      calories: goals.calories,
      proteins_g: goals.proteinsG,
      carbs_g: goals.carbsG,
      fats_g: goals.fatsG,
      meals_per_day: goals.mealsPerDay,
    }),
  })
}
