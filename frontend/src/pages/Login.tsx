import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login as loginRequest } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true)
    setError(null)
    try {
      const data = await loginRequest(email, password)
      login(data.access_token, data.user)
      navigate('/')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <div className="auth-page__logo">
          🍽️ Mise en <span>Bouche</span>
        </div>

        <h1 className="auth-page__title">Connexion</h1>
        <p className="auth-page__sub">Content de te revoir !</p>

        {error && <div className="auth-page__error">{error}</div>}

        <div className="auth-page__field">
          <label>Email</label>
          <input
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="auth-page__field">
          <label>Mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <button
          className="auth-page__submit"
          onClick={handleLogin}
          disabled={loading || !email || !password}
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div className="auth-page__link">
          Pas encore de compte ?{' '}
          <button onClick={() => navigate('/register')}>S'inscrire</button>
        </div>
      </div>
    </div>
  )
}