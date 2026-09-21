const API_URL = import.meta.env.VITE_API_URL

/**
 * Resolves a media URL returned by the backend into an absolute URL.
 * Relative /uploads paths are prefixed with the API base URL; any other
 * URL (e.g. an external thumbnail) is returned as-is.
 *
 * @param url - The media URL as returned by the API
 * @returns An absolute URL usable directly in an <img src>
 */
export function resolveMediaUrl(url: string): string {
  return url.startsWith('/uploads') ? `${API_URL}${url}` : url
}

/**
 * Formats an ingredient quantity scaled to a chosen number of portions.
 * The base quantity is defined for `servings` portions and is rescaled
 * to `multiplier` portions.
 *
 * @param quantity - The base quantity as a string (may be null or non-numeric)
 * @param multiplier - The number of portions the user wants
 * @param servings - The number of portions the base quantity was defined for
 * @returns The scaled quantity as a string, or null if there's no quantity
 */
export function formatQty(quantity: string | null, multiplier: number, servings: number): string | null {
  if (!quantity) return null
  const num = parseFloat(quantity)
  if (isNaN(num)) return quantity
  const result = (num / servings) * multiplier
  const rounded = Math.abs(result - Math.round(result)) < 0.05
    ? Math.round(result)
    : parseFloat(result.toFixed(1))
  return rounded.toString()
}
