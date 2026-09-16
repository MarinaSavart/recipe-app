


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
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      return { token: savedToken, user: JSON.parse(savedUser) as User }
    }

    return { token: null, user: null }
  })
  const [user, setUser] = useState<User | null>(session.user)
  const [token, setToken] = useState<string | null>(session.token)
  const isLoading = false

  function login(token: string, user: User) {
    setToken(token)
    setUser(user)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}