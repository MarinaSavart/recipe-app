const URL_PATTERN = /https?:\/\/[^\s"'<>]+/

/**
 * Extracts the link shared to the app (Web Share Target or an iOS Shortcut).
 * Apps don't agree on where they put it: Instagram and TikTok often send it
 * inside `text` with a caption around it, so each field is searched in turn.
 */
export function extractSharedUrl(params: URLSearchParams): string {
  for (const key of ['url', 'text', 'title']) {
    const match = params.get(key)?.match(URL_PATTERN)
    if (match) return match[0]
  }
  return ''
}
