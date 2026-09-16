import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import RecipeList from './pages/RecipeList'
import RecipeDetail from './pages/RecipeDetail'
import RecipeImport from './pages/RecipeImport'
import RecipeEdit from './pages/RecipeEdit'
import Login from './pages/Login'
import Register from './pages/Register'
import './styles/main.scss'

type Theme = 'dark' | 'light'

// Protège les routes — redirige vers /login si non connecté
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AppLayout() {
  const [recipeCount, setRecipeCount] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function handleToggle() {
    if (window.innerWidth <= 768) {
      setMobileOpen(o => !o)
    } else {
      setCollapsed(o => !o)
    }
  }

  return (
    <>
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)}>
        {mobileOpen ? '✕' : '☰'}
      </button>

      {mobileOpen && (
        <div
          className="navbar-overlay navbar-overlay--visible"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="layout">
        <Navbar
          recipeCount={recipeCount}
          collapsed={collapsed}
          onToggle={handleToggle}
          mobileOpen={mobileOpen}
          theme={theme}
          onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        />
        <main className={`main ${collapsed ? 'main--collapsed' : ''}`}>
          <Routes>
            <Route path="/"                 element={<RecipeList onCountChange={setRecipeCount} />} />
            <Route path="/recipes/:id"      element={<RecipeDetail />} />
            <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
            <Route path="/import"           element={<RecipeImport />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Routes protégées */}
          <Route path="/*" element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)