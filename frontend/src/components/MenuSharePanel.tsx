import type { MenuGuest } from '../types/menu'
import { guestLabel } from '../utils/menu'

interface MenuSharePanelProps {
  inviteUrl: string | null  // null while the link is loading
  guests: MenuGuest[]
  busy: boolean
  onCopy: () => void
  onRemoveGuest: (guest: MenuGuest) => void
  onClose: () => void
}

/** Owner's sharing panel: the invitation link to send, and the guests who joined the menu. */
export default function MenuSharePanel({ inviteUrl, guests, busy, onCopy, onRemoveGuest, onClose }: MenuSharePanelProps) {
  return (
    <section className="menu-share" aria-label="Partage du menu">
      <div className="menu-share__header">
        <div>
          <h2 className="menu-share__title">🔗 Partager le menu</h2>
          <p className="menu-share__hint">
            Envoie ce lien : toute personne connectée qui l'ouvre pourra voir et modifier ce menu (mais pas le supprimer).
          </p>
        </div>
        <button className="menu-share__close" onClick={onClose} aria-label="Fermer le partage">×</button>
      </div>

      <div className="menu-share__link">
        <input
          className="menu-share__input"
          value={inviteUrl ?? 'Chargement…'}
          readOnly
          aria-label="Lien d'invitation"
          onFocus={e => e.target.select()}
        />
        <button className="btn-primary btn-primary--sm" onClick={onCopy} disabled={!inviteUrl}>
          Copier le lien
        </button>
      </div>

      <h3 className="menu-share__subtitle">Partagé avec</h3>
      {guests.length === 0 ? (
        <p className="menu-share__empty">Personne pour l'instant.</p>
      ) : (
        <ul className="menu-share__guests">
          {guests.map(guest => (
            <li key={guest.id} className="menu-share__guest">
              <span className="menu-share__guest-name">{guestLabel(guest)}</span>
              <button
                className="btn-ghost btn-ghost--danger"
                onClick={() => onRemoveGuest(guest)}
                disabled={busy}
              >
                Ne plus partager
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
