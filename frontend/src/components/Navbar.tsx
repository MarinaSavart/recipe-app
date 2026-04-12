import { useNavigate, useLocation } from 'react-router-dom'

interface NavItem {
  icon: string
  label: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: '📚', label: 'Mes recettes', path: '/' },
  { icon: '⚡', label: 'Importer',     path: '/import' },
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

  return (
    <>
      <nav className={`navbar ${collapsed ? 'navbar--collapsed' : ''} ${mobileOpen ? 'navbar--open' : ''}`}>

        <button className="navbar__toggle" onClick={onToggle} title={collapsed ? 'Agrandir' : 'Réduire'}>
          {collapsed ? '→' : '←'}
        </button>

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

        {/* Toggle thème en bas de la navbar */}
        <button
          className="navbar__theme-btn"
          onClick={onThemeToggle}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        >
          <span className="icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="navbar__btn-label">
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </span>
        </button>

      </nav>
    </>
  )
}