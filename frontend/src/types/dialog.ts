/** Content of a confirmation dialog (replaces the browser's native confirm()). */
export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string  // defaults to "Confirmer"
  cancelLabel?: string   // defaults to "Annuler"
  danger?: boolean       // destructive action: red confirm button
}
