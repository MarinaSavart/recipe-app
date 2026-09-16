import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister() {
    if (!name || !email || !password) return
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail ?? "Erreur lors de l'inscription")
      }
      const data = await res.json()
      login(data.access_token, data.user)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
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

        <h1 className="auth-page__title">Créer un compte</h1>
        <p className="auth-page__sub">Rejoins l'aventure !</p>

        {error && <div className="auth-page__error">{error}</div>}

        <div className="auth-page__field">
          <label>Prénom</label>
          <input
            type="text"
            placeholder="Marina"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="auth-page__field">
          <label>Email</label>
          <input
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className="auth-page__field">
          <label>Mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <div className="auth-page__field">
          <label>Confirme le mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
          />
        </div>

        <button
          className="auth-page__submit"
          onClick={handleRegister}
          disabled={loading || !name || !email || !password || !confirm}
        >
          {loading ? 'Création…' : 'Créer mon compte'}
        </button>

        <div className="auth-page__link">
          Déjà un compte ?{' '}
          <button onClick={() => navigate('/login')}>Se connecter</button>
        </div>
      </div>
    </div>
  )
}