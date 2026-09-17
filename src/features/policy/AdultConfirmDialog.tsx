import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmAdult } from '@/api/policy'
import { ApiError } from '@/shared/lib/apiClient'
import type { AuthUser } from '@/stores/authStore'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/Dialog'

type AdultConfirmDialogProps = {
  open: boolean
  onCancel: () => void
  onConfirmed: (user: AuthUser) => void
}

/** Qué cambia al confirmar: Explorar enseña los +18 y los libros dejan de pedir confirmación. */
const ADULT_QUERY_KEYS = [['book'], ['explore'], ['characters'], ['profile']]

export function AdultConfirmDialog({ open, onCancel, onConfirmed }: AdultConfirmDialogProps) {
  const queryClient = useQueryClient()
  // El foco empieza en Cancelar: confirmar tiene que ser un gesto deliberado.
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirm = useMutation({
    mutationFn: confirmAdult,
    onSuccess: (user) => {
      for (const queryKey of ADULT_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey })
      onConfirmed(user)
    },
  })

  function cancel() {
    confirm.reset()
    onCancel()
  }

  return (
    <Dialog
      open={open}
      title="Contenido para mayores de edad"
      onClose={cancel}
      busy={confirm.isPending}
      initialFocusRef={cancelRef}
    >
      <p className="text-body-sm text-ink-dim">
        Los libros +18 solo se abren con esta confirmación. Al continuar declaras que eres mayor de edad. Las escenas íntimas siguen cerrándose con
        un fundido a negro, y puedes retirar esta confirmación cuando quieras desde Configuración.
      </p>
      {confirm.isError ? (
        <p role="alert" className="text-body-sm text-error">
          {confirm.error instanceof ApiError ? confirm.error.message : 'No se pudo guardar la confirmación.'}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} variant="outline" disabled={confirm.isPending} onClick={cancel}>
          Cancelar
        </Button>
        <Button variant="brand" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
          {confirm.isPending ? 'Confirmando…' : 'Soy mayor de edad'}
        </Button>
      </div>
    </Dialog>
  )
}
