import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Field } from '@/shared/ui/Field'
import { AuthShell, ArrowIcon, LockIcon, authCtaClassName, authCtaStyle } from '@/features/auth/AuthShell'
import { register } from '@/api/auth'
import { MIN_AGE } from '@/content/legal/version'
import { ConsentCheckbox, LegalLink } from '@/features/legal/LegalLinks'
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

function consentProblem(acceptTerms: boolean, minAge: boolean) {
  if (!acceptTerms && !minAge) {
    return `Para crear la cuenta tienes que aceptar los términos y confirmar que tienes al menos ${MIN_AGE} años.`
  }
  if (!acceptTerms) return 'Para crear la cuenta tienes que aceptar los términos y la política de privacidad.'
  return `Para crear la cuenta tienes que confirmar que tienes al menos ${MIN_AGE} años.`
}

export function RegisterPage() {
  const user = useAuthStore((s) => s.user)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [minAge, setMinAge] = useState(false)
  const [consentTried, setConsentTried] = useState(false)
  const termsRef = useRef<HTMLDivElement>(null)

  if (user) return <Navigate to={routes.characters} replace />

  const problem = password ? passwordProblem(password) : null
  const consentMissing = !acceptTerms || !minAge
  const consentError = consentTried && consentMissing ? consentProblem(acceptTerms, minAge) : null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (consentMissing) {
      setConsentTried(true)
      setError(null)
      // El foco va a la primera casilla sin marcar para que el aviso se oiga junto a ella.
      termsRef.current?.querySelector<HTMLInputElement>(acceptTerms ? '#min-age' : '#accept-terms')?.focus()
      return
    }
    const localProblem = passwordProblem(password)
    if (localProblem) {
      setError(localProblem)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await register(username, password, displayName, { acceptTerms, minAgeConfirmed: minAge })
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

        <div ref={termsRef} role="group" aria-label="Condiciones" className="mb-4 flex flex-col gap-3">
          <ConsentCheckbox
            id="accept-terms"
            checked={acceptTerms}
            onChange={setAcceptTerms}
            invalid={consentTried && !acceptTerms}
            errorId="consent-error"
          >
            He leído y acepto los{' '}
            <LegalLink to={routes.terminos} newTab>
              términos
            </LegalLink>{' '}
            y la{' '}
            <LegalLink to={routes.privacidad} newTab>
              política de privacidad
            </LegalLink>
            .
          </ConsentCheckbox>
          <ConsentCheckbox id="min-age" checked={minAge} onChange={setMinAge} invalid={consentTried && !minAge} errorId="consent-error">
            Tengo al menos {MIN_AGE} años.
          </ConsentCheckbox>
          {consentError ? (
            <p id="consent-error" className="text-[13px] text-error" role="alert">
              {consentError}
            </p>
          ) : null}
        </div>

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
