import { useState } from 'react'
import type { KeyboardEvent } from 'react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  autoComplete: 'current-password' | 'new-password'
  placeholder?: string
}

/** Password field with an eye button to show / hide what's typed. */
export default function PasswordInput({ value, onChange, onKeyDown, autoComplete, placeholder = '••••••••' }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-input">
      <input
        className="password-input__field"
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {/* Slash over the eye while the password is shown: click hides it again */}
          {visible && <line x1="3" y1="3" x2="21" y2="21" />}
        </svg>
      </button>
    </div>
  )
}
