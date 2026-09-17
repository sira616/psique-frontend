import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Field } from '@/shared/ui/Field'
import { AuthShell, ArrowIcon, LockIcon, authCtaClassName, authCtaStyle } from '@/features/auth/AuthShell'
import { register } from '@/api/auth'
import { ApiError } from '@/shared/lib/apiClient'
import { routes } from '@/router/paths'
import { useAuthStore } from '@/stores/authStore'

// Misma política que el backend (app/core/passwords.py). Se comprueba aquí solo para
// avisar antes; quien decide es el servidor.
const MIN_PASSWORD = 12

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Al menos ${MIN_PASSWORD} caracteres.`
  if (!/[a-z]/.test(password)) return 'Falta alguna minúscula.'
  if (!/[A-Z]/.test(password)) return 'Falta alguna mayúscula.'
  if (!/\d/.test(password)) return 'Falta algún número.'
  return null
}

export function RegisterPage() {
  const user = useAuthStore((s) => s.user)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={routes.characters} replace />

  const problem = password ? passwordProblem(password) : null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const localProblem = passwordProblem(password)
    if (localProblem) {
      setError(localProblem)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await register(username, password, displayName)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate>
        <Field
          id="username"
          label="Usuario"
          autoComplete="username"
          placeholder="3-32 caracteres, sin espacios"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Field
          id="displayName"
          label="Cómo quieres que te llamen (opcional)"
          autoComplete="nickname"
          maxLength={64}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Field
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-help"
          required
          lead={<LockIcon />}
        />
        <p id="password-help" className="-mt-2 mb-4 text-[12px] text-ink-faint">
          {problem ?? 'Mínimo 12 caracteres con mayúscula, minúscula y número.'}
        </p>

        {error ? (
          <p className="mb-3 text-[13px] text-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className={authCtaClassName} style={authCtaStyle}>
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          {!submitting ? <ArrowIcon /> : null}
        </button>

        <p className="mt-4 text-center text-[13px] text-ink-dim">
          ¿Ya tienes cuenta?{' '}
          <Link to={routes.login} className="font-semibold text-accent-text underline">
            Entra
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
