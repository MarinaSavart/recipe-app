import { StrictMode, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import RecipeList from './pages/RecipeList'
import RecipeDetail from './pages/RecipeDetail'
import RecipeImport from './pages/RecipeImport'
import RecipeEdit from './pages/RecipeEdit'
import FavoritesRecipes from './pages/FavoritesRecipes'
import Login from './pages/Login'
import Register from './pages/Register'
import './styles/main.scss'
import Profile from './pages/Profile'
import MenuList from './pages/MenuList'
import MenuCreate from './pages/MenuCreate'
import MenuDetail from './pages/MenuDetail'

type Theme = 'dark' | 'light'

/** Guards routes — redirects to /login when the user isn't logged in. */
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

/** Main authenticated layout: navbar, mobile menu, theme toggle, and routed pages. */
function AppLayout() {
  const [recipeCount, setRecipeCount] = useState(0)
  const [favoritesCount, setFavoritesCount] = useState(0)
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
          favoritesCount={favoritesCount}
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
            <Route path="/favorites"        element={<FavoritesRecipes onCountChange={setFavoritesCount} />} />
            <Route path="/profile"           element={<Profile />} />
            <Route path="/menus"            element={<MenuList />} />
            <Route path="/menus/create"     element={<MenuCreate />} />
            <Route path="/menus/:id"        element={<MenuDetail />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

/** Application root: sets up routing between public pages and the private layout. */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
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