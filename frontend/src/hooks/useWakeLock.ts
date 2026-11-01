import { useEffect } from 'react'

/**
 * Keeps the screen awake while the calling component is mounted (Screen Wake Lock API),
 * e.g. while following a recipe. The browser releases the lock when the page is hidden
 * (tab switch, app in background), so it's requested again when the page shows up.
 * No-op on browsers without the API or when the request is refused (e.g. battery saver).
 */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let unmounted = false

    async function acquire() {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        // Unmounted while the request was pending: don't keep the screen on
        if (unmounted) {
          await lock.release()
          return
        }
        sentinel = lock
      } catch (e) {
        console.warn('Screen wake lock refused:', e)
      }
    }

    acquire()
    document.addEventListener('visibilitychange', acquire)

    return () => {
      unmounted = true
      document.removeEventListener('visibilitychange', acquire)
      sentinel?.release().catch(() => {})
    }
  }, [])
}
