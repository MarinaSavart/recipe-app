import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  icon: string
  label: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: '📚', label: 'Recettes', path: '/' },
  { icon: '⚡', label: 'Importer',     path: '/import' },
  { icon: '❤️', label: 'Mes favoris',  path: '/favorites' },
  { icon: '👤', label: 'Profil',       path: '/profile' },
]

interface NavbarProps {
  recipeCount: number
  favoritesCount: number
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}

/** Sidebar navigation: main nav links, theme toggle, collapse toggle, and account section. */
export default function Navbar({ recipeCount, favoritesCount, collapsed, onToggle, mobileOpen, theme, onThemeToggle }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <>
      <nav className={`navbar ${collapsed ? 'navbar--collapsed' : ''} ${mobileOpen ? 'navbar--open' : ''}`}>

        <div className="navbar__container-toggle">
          {/* Theme toggle at the bottom of the navbar */}
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

        {/* Navbar logo */}
        <div className="navbar__logo" onClick={() => navigate('/')}>
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
              {item.path === '/favorites' && (
                <span className="navbar__count">{favoritesCount}</span>
              )}
            </button>
          ))}
        </div>

        {user && (
          <div className="navbar__section navbar__section--bottom">
            <div className="navbar__label">Compte</div>
            <div className="navbar__user-email">
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