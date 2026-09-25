import { useRef } from 'react'
import type { CustomStory } from '@/api/customStories'
import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/Dialog'

type DeleteStoryDialogProps = {
  /** null cerrado; con historia, abierto y preguntando por ella. */
  story: CustomStory | null
  onCancel: () => void
  onConfirm: (story: CustomStory) => void
  pending?: boolean
  error?: unknown
}

/**
 * Confirmación de borrado, una sola para la sección y para el detalle: si el aviso viviera en
 * dos sitios, uno de los dos acabaría contando otra cosa.
 *
 * Lo que dice es lo que hace el backend: las partidas ajenas que ya están en marcha sobreviven
 * al borrado (siguen jugándose con el perfil que ya tienen), la historia sale de Explorar y
 * desaparece de la cuenta junto con las partidas propias.
 */
export function DeleteStoryDialog({ story, onCancel, onConfirm, pending = false, error }: DeleteStoryDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  if (!story) return null

  return (
    <Dialog
      open
      title={`¿Borrar «${story.title}»?`}
      onClose={onCancel}
      busy={pending}
      initialFocusRef={cancelRef}
    >
      <p className="text-body-sm text-ink">
        Se borrará la historia y tus propias partidas con ella. No se puede deshacer.
      </p>
      <p className="text-body-sm text-ink-dim">
        Si otras cuentas la están jugando, sus partidas siguen jugables: se quedan con el personaje tal
        como está ahora. La historia deja de aparecer en Explorar, nadie más podrá empezarla y desaparece
        de tus historias.
      </p>
      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error instanceof ApiError ? error.message : 'No se pudo borrar la historia.'}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button variant="danger" className="sm:flex-1" disabled={pending} onClick={() => onConfirm(story)}>
          {pending ? 'Borrando…' : 'Sí, borrar'}
        </Button>
        <Button ref={cancelRef} variant="outline" className="sm:flex-1" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Dialog>
  )
}
