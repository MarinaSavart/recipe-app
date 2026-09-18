import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  icon: string
  label: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: '📚', label: 'Mes recettes', path: '/' },
  { icon: '⚡', label: 'Importer',     path: '/import' },
  { icon: '👤', label: 'Profil',       path: '/profile' },
]

interface NavbarProps {
  recipeCount: number
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}

export default function Navbar({ recipeCount, collapsed, onToggle, mobileOpen, theme, onThemeToggle }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <>
      <nav className={`navbar ${collapsed ? 'navbar--collapsed' : ''} ${mobileOpen ? 'navbar--open' : ''}`}>

        <div className="navbar__container-toggle">
          {/* Toggle thème en bas de la navbar */}
          <button
            className="navbar__toggle"
            onClick={onThemeToggle}
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="navbar__toggle" onClick={onToggle} title={collapsed ? 'Agrandir' : 'Réduire'}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Logo de la navbar */}
        <div className="navbar__logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="navbar__logo-icon">🍽️</span>
          <span className="navbar__logo-text">
            Mise en <span>Bouche</span>
          </span>
        </div>

        <div className="navbar__section">
          <div className="navbar__label">Navigation</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`navbar__btn ${location.pathname === item.path ? 'navbar__btn--active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              <span className="icon">{item.icon}</span>
              <span className="navbar__btn-label">{item.label}</span>
              {item.path === '/' && (
                <span className="navbar__count">{recipeCount}</span>
              )}
            </button>
          ))}
        </div>

        {user && (
          <div className="navbar__section" style={{ marginTop: 'auto' }}>
            <div className="navbar__label">Compte</div>
            <div style={{ padding: '0 12px 8px', fontSize: 13, color: 'var(--muted)' }}>
              {user.name ?? user.email}
            </div>
            <button className="navbar__theme-btn" onClick={logout}>
              <span className="icon">🚪</span>
              <span className="navbar__btn-label">Déconnexion</span>
            </button>
          </div>
        )}

      </nav>
    </>
  )
}