/** Source platforms available for recipe import and filtering. */
export const PLATFORMS = [
  { key: 'instagram', label: '📸 Instagram' },
  { key: 'tiktok',    label: '🎵 TikTok' },
  { key: 'youtube',   label: '▶️ YouTube' },
  { key: 'web',       label: '🌐 Site web' },
  { key: 'manual',    label: '✍️ Manuel' },
] as const

export type PlatformKey = typeof PLATFORMS[number]['key']

/** Returns the display label (with emoji) for a platform key, or null if unknown. */
export function getPlatformLabel(key: string | null): string | null {
  if (!key) return null
  return PLATFORMS.find(p => p.key === key)?.label ?? null
}

/** Author as shown on a recipe: "@handle" for social accounts, the plain name for a website. */
export function formatSourceAuthor(author: string, platform: string | null): string {
  return platform === 'web' ? author : `@${author}`
}

/** Label of the link to the recipe's source: a video, or a website page. */
export function sourceLinkLabel(platform: string | null): string {
  return platform === 'web' ? 'Voir la recette sur le site' : 'Voir la vidéo originale'
}
