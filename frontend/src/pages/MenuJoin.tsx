import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { joinMenu } from '../services/api'

/** Opened from a menu's invitation link: joins the menu, then shows it. */
export default function MenuJoin() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    // Joining is idempotent on the backend, so StrictMode's double run is harmless
    joinMenu(token)
      .then(menu => navigate(`/menus/${menu.id}`, { replace: true }))
      .catch((e: Error) => setError(e.message))
  }, [token, navigate])

  if (error) {
    return (
      <div className="empty">
        <div className="empty__icon">⚠️</div>
        <div className="empty__title">Impossible de rejoindre ce menu</div>
        <div className="empty__sub">{error}</div>
      </div>
    )
  }

  return (
    <div className="empty">
      <div className="empty__icon">⏳</div>
      <div className="empty__title">Ouverture du menu partagé…</div>
    </div>
  )
}
