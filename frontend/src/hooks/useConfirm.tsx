import { useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import type { ConfirmOptions } from '../types/dialog'

/**
 * Promise-based replacement for the browser's confirm():
 * `if (!(await confirm({ title: '…' }))) return`, with `dialog` rendered by the page.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  /** Opens the dialog; resolves to true on confirm, false on cancel. */
  function confirm(next: ConfirmOptions): Promise<boolean> {
    resolveRef.current?.(false)  // a dialog still open counts as cancelled
    setOptions(next)
    return new Promise(resolve => {
      resolveRef.current = resolve
    })
  }

  function close(confirmed: boolean) {
    resolveRef.current?.(confirmed)
    resolveRef.current = null
    setOptions(null)
  }

  const dialog = options && (
    <ConfirmDialog {...options} onConfirm={() => close(true)} onCancel={() => close(false)} />
  )

  return { confirm, dialog }
}
