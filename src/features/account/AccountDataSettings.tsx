import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DELETE_CONFIRMATION, deleteAccount, downloadMyData, isInvalidPassword } from '@/api/account'
import { StoryField } from '@/features/customStories/StoryField'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/Dialog'
import { useAuthStore } from '@/stores/authStore'

type Errors = { password?: string; confirmation?: string; general?: string }

function validate(password: string, confirmation: string): Errors {
  const errors: Errors = {}
  if (!password) errors.password = 'Escribe tu contraseña actual.'
  if (confirmation.trim() !== DELETE_CONFIRMATION) errors.confirmation = `Escribe ${DELETE_CONFIRMATION} en mayúsculas para confirmar.`
  return errors
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const cancelRef = useRef<HTMLButtonElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const remove = useMutation({
    mutationFn: () => deleteAccount(password, confirmation.trim()),
    onSuccess: () => {
      // La cookie ya la borró el servidor; aquí se olvida la sesión y todo lo cacheado de la cuenta.
      useAuthStore.getState().clearSession()
      queryClient.clear()
      navigate(routes.login, { replace: true })
    },
    onError: (error) => {
      if (isInvalidPassword(error)) {
        setErrors({ password: 'La contraseña no es correcta.' })
        document.getElementById('borrar-password')?.focus()
        return
      }
      setErrors({ general: error instanceof ApiError ? error.message : 'No se pudo borrar la cuenta.' })
    },
  })

  function close() {
    if (remove.isPending) return
    setPassword('')
    setConfirmation('')
    setErrors({})
    remove.reset()
    onClose()
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = validate(password, confirmation)
    setErrors(next)
    if (next.password) return document.getElementById('borrar-password')?.focus()
    if (next.confirmation) return document.getElementById('borrar-confirmacion')?.focus()
    remove.mutate()
  }

  return (
    <Dialog open={open} title="Borrar tu cuenta" onClose={close} busy={remove.isPending} initialFocusRef={cancelRef}>
      <form noValidate onSubmit={onSubmit} className="space-y-3">
        <p className="text-body-sm text-ink-dim">
          Se borran para siempre tu perfil, tus partidas y mensajes, reseñas, óbolos y tarjetas. Tus historias que otras personas
          están leyendo quedan sin autor y dejan de publicarse, para no cortar sus partidas. No se puede deshacer.
        </p>
        <StoryField
          id="borrar-password"
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          required
        />
        <StoryField
          id="borrar-confirmacion"
          label={`Escribe ${DELETE_CONFIRMATION} para confirmar`}
          autoComplete="off"
          spellCheck={false}
          value={confirmation}
          onChange={setConfirmation}
          error={errors.confirmation}
          required
        />
        {errors.general ? (
          <p role="alert" className="text-body-sm text-error">
            {errors.general}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" disabled={remove.isPending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={remove.isPending}>
            {remove.isPending ? 'Borrando…' : 'Borrar mi cuenta'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function AccountDataSettings({ announce }: { announce: (message: string) => void }) {
  const handle = useAuthStore((s) => s.user?.handle ?? 'cuenta')
  const [deleting, setDeleting] = useState(false)
  const download = useMutation({
    mutationFn: () => downloadMyData(handle),
    onSuccess: () => announce('Descarga de tus datos preparada.'),
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-body-sm font-semibold text-ink">Descargar tus datos</h3>
        <p className="text-body-sm text-ink-dim">
          Un archivo JSON con tu perfil, historias propias, partidas con sus mensajes, reseñas, óbolos y tarjetas.
        </p>
        <Button variant="outline" disabled={download.isPending} onClick={() => download.mutate()}>
          {download.isPending ? 'Preparando…' : 'Descargar mis datos'}
        </Button>
        {download.isError ? (
          <p role="alert" className="text-body-sm text-error">
            {download.error instanceof ApiError ? download.error.message : 'No se pudieron descargar tus datos.'}
          </p>
        ) : null}
      </div>
      <div className="space-y-2 border-t border-[color:var(--ps-line)] pt-6">
        <h3 className="text-body-sm font-semibold text-ink">Borrar la cuenta</h3>
        <p className="text-body-sm text-ink-dim">Elimina tu cuenta y lo que has hecho en Psique. Te pediremos la contraseña.</p>
        <Button variant="danger" aria-haspopup="dialog" onClick={() => setDeleting(true)}>
          Borrar cuenta
        </Button>
      </div>
      <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
    </div>
  )
}
