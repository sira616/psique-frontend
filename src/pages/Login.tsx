import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Field } from '@/shared/ui/Field'
import {
  AuthShell,
  ArrowIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  authCtaClassName,
  authCtaStyle,
} from '@/features/auth/AuthShell'
import { login } from '@/api/auth'
import { ApiError } from '@/shared/lib/apiClient'
import { routes } from '@/router/paths'
import { useAuthStore } from '@/stores/authStore'

/** Solo rutas internas: un `?next=https://...` convertiría el login en un redirector abierto. */
export function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to={safeInternalPath(params.get('next')) ?? routes.characters} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Al guardar la sesión, el <Navigate> de arriba redirige solo.
      await login(username, password)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? 'Usuario o contraseña incorrectos.'
            : err.message
          : 'No se pudo iniciar sesión.',
      )
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
          name="username"
          autoComplete="username"
          placeholder="tu_usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          lead={<UserIcon />}
        />
        <Field
          id="password"
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          lead={<LockIcon />}
          trail={
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-dim hover:text-ink"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          }
        />

        {import.meta.env.DEV ? (
          <p className="mb-4 text-[12px] text-ink-faint">Cuenta de prueba: demo / DemoPsique2026</p>
        ) : null}

        {error ? (
          <p className="mb-3 text-[13px] text-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className={authCtaClassName} style={authCtaStyle}>
          {submitting ? 'Entrando…' : 'Entrar'}
          {!submitting ? <ArrowIcon /> : null}
        </button>

        <p className="mt-4 text-center text-[13px] text-ink-dim">
          ¿No tienes cuenta?{' '}
          <Link to={routes.registro} className="font-semibold text-accent-text underline">
            Regístrate
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
