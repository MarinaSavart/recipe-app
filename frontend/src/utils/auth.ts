/**
 * Page to go to after logging in / registering: the one requested before being
 * sent to /login (router state `{ from }`), else the home page.
 * Only app-internal paths are accepted.
 */
export function redirectAfterAuth(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const { from } = state
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from
  }
  return '/'
}
