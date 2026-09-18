import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface User {
  id: number
  email: string
  name: string | null
  avatar_url: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

/** Reads and parses the persisted session (token + user) from localStorage, if valid. */
function readStoredSession(): { token: string | null; user: User | null } {
  const savedToken = localStorage.getItem('token')
  const savedUser = localStorage.getItem('user')

  if (!savedToken || !savedUser) return { token: null, user: null }

  try {
    return { token: savedToken, user: JSON.parse(savedUser) as User }
  } catch {
    return { token: null, user: null }
  }
}

/**
 * Provides the current auth session (user + token) to the component tree,
 * persisting it to localStorage across page reloads.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session] = useState(readStoredSession)
  const [user, setUser] = useState<User | null>(session.user)
  const [token, setToken] = useState<string | null>(session.token)

  /** Stores the session in state and localStorage after a successful login/register. */
  function login(token: string, user: User) {
    setToken(token)
    setUser(user)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }

  /** Clears the session from state and localStorage. */
  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Accesses the current auth context. Must be used within an AuthProvider. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}