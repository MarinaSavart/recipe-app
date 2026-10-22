import { useEffect, useId, useRef } from 'react'
import type { ConfirmOptions } from '../types/dialog'

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal confirmation dialog, built on the native <dialog> element (focus trap,
 * Escape key, backdrop). Escape and a click outside the panel cancel.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // The dialog is only mounted while open: show it as a modal once in the DOM
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={e => {
        e.preventDefault()  // let React unmount it instead of the browser closing it
        onCancel()
      }}
      onClick={e => {
        // The panel fills the dialog: a click on the dialog itself is on the backdrop
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="confirm-dialog__panel">
        <h2 id={titleId} className="confirm-dialog__title">{title}</h2>
        {message && <p className="confirm-dialog__message">{message}</p>}
        <div className="confirm-dialog__actions">
          <button className="btn-ghost" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={`btn-primary confirm-dialog__confirm ${danger ? 'confirm-dialog__confirm--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
