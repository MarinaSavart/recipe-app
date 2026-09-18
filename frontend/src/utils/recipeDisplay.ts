const API_URL = import.meta.env.VITE_API_URL

export function resolveMediaUrl(url: string): string {
  return url.startsWith('/uploads') ? `${API_URL}${url}` : url
}

export function platformLabel(platform: string | null): string {
  if (platform === 'instagram') return '📸 Instagram'
  if (platform === 'tiktok') return '🎵 TikTok'
  if (platform === 'manual') return '✍️ Manuel'
  return platform ?? ''
}

// quantité de base = pour `servings` portions, adaptée au nombre de portions choisi
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
