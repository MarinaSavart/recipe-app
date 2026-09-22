/** Source platforms available for recipe import and filtering. */
export const PLATFORMS = [
  { key: 'instagram', label: '📸 Instagram' },
  { key: 'tiktok',    label: '🎵 TikTok' },
  { key: 'youtube',   label: '▶️ YouTube' },
  { key: 'manual',    label: '✍️ Manuel' },
] as const

export type PlatformKey = typeof PLATFORMS[number]['key']

/** Returns the display label (with emoji) for a platform key, or null if unknown. */
export function getPlatformLabel(key: string | null): string | null {
  if (!key) return null
  return PLATFORMS.find(p => p.key === key)?.label ?? null
}
