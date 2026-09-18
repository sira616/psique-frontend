import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { acceptTerms, termsOutdatedOf } from '@/api/legal'
import { MIN_AGE } from '@/content/legal/version'
import { ConsentCheckbox, LegalLink } from '@/features/legal/LegalLinks'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/Dialog'
import { useAuthStore } from '@/stores/authStore'

// No se cierra: seguir usando Psique exige aceptar la versión vigente.
const noop = () => {}

/**
 * Bloquea la app mientras la cuenta no haya aceptado la versión vigente de términos y
 * privacidad. Vive dentro del layout con sesión, así /terminos y /privacidad quedan libres.
 */
export function TermsGate() {
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const [checked, setChecked] = useState(false)
  const [outdatedNotice, setOutdatedNotice] = useState<string | null>(null)
  const checkboxId = useId()
  const accept = useMutation({
    mutationFn: (version: string) => acceptTerms(version),
    onError: (error) => {
      const outdated = termsOutdatedOf(error)
      if (!outdated) return
      // Hay una versión más nueva: hay que volver a leer y marcar.
      patchUser({ termsVersion: outdated.termsVersion })
      setChecked(false)
      setOutdatedNotice(outdated.detail)
    },
  })

  if (!user || user.termsAccepted !== false) return null

  const genericError =
    accept.isError && !termsOutdatedOf(accept.error)
      ? accept.error instanceof ApiError
        ? accept.error.message
        : 'No se pudo guardar la aceptación. Inténtalo de nuevo.'
      : null

  return (
    <Dialog open title="Hemos actualizado los términos" onClose={noop} busy={accept.isPending}>
      <p className="text-body-sm text-ink-dim">
        Para seguir usando Psique necesitamos que leas y aceptes la versión {user.termsVersion} de los{' '}
        <LegalLink to={routes.terminos} newTab>
          términos de uso
        </LegalLink>{' '}
        y de la{' '}
        <LegalLink to={routes.privacidad} newTab>
          política de privacidad
        </LegalLink>
        .
      </p>
      {outdatedNotice ? (
        <p role="alert" className="text-body-sm text-error">
          {outdatedNotice} Ahora la vigente es la {user.termsVersion}.
        </p>
      ) : null}
      <ConsentCheckbox id={checkboxId} checked={checked} onChange={setChecked} disabled={accept.isPending}>
        He leído y acepto los términos y la política de privacidad, y tengo al menos {MIN_AGE} años.
      </ConsentCheckbox>
      {genericError ? (
        <p role="alert" className="text-body-sm text-error">
          {genericError}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button variant="brand" disabled={!checked || accept.isPending} onClick={() => accept.mutate(user.termsVersion)}>
          {accept.isPending ? 'Guardando…' : 'Aceptar y seguir'}
        </Button>
      </div>
    </Dialog>
  )
}
