import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  customStoryFieldErrors,
  deleteCustomStoryCover,
  uploadCustomStoryCover,
  type CustomStory,
} from '@/api/customStories'
import { COVER_MAX_MB, coverProblem } from '@/features/customStories/limits'
import { StoryCover } from '@/features/customStories/StoryCover'
import { IMAGE_ACCEPT } from '@/features/profile/limits'
import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'
import { Icon, IconBorrar, IconPortada } from '@/shared/ui/icons'

type StoryCoverFieldProps = {
  story: CustomStory
  /** Recibe la historia que devuelve el servidor tras subir, o la misma sin portada al quitarla. */
  onChanged: (story: CustomStory) => void
  onAnnounce: (message: string) => void
}

/**
 * Portada de una historia propia: elegir → previsualizar → subir, y quitar la que haya. Mismo
 * recorrido que la foto y el banner del perfil (`ProfileImageField`), con los límites de la
 * portada y los errores por campo del backend (`file`).
 */
export function StoryCoverField({ story, onChanged, onAnnounce }: StoryCoverFieldProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Los botones de confirmar desaparecen al terminar: el foco vuelve al selector de archivo.
  const refocusInput = useRef(false)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function reset() {
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const upload = useMutation({
    mutationFn: (selected: File) => uploadCustomStoryCover(story.id, selected),
    onSuccess: (updated) => {
      reset()
      setError(null)
      refocusInput.current = true
      onChanged(updated)
      onAnnounce('Portada actualizada.')
    },
    onError: (err) => {
      setError(
        customStoryFieldErrors(err).file ??
          (err instanceof ApiError ? err.message : 'No se pudo subir la portada.'),
      )
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteCustomStoryCover(story.id),
    onSuccess: () => {
      setError(null)
      refocusInput.current = true
      onChanged({ ...story, coverUrl: null })
      onAnnounce('Portada quitada.')
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo quitar la portada.'),
  })

  const busy = upload.isPending || remove.isPending

  useEffect(() => {
    if (!busy && refocusInput.current) {
      refocusInput.current = false
      inputRef.current?.focus()
    }
  }, [busy])

  function onSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    const problem = coverProblem(selected)
    if (problem) {
      reset()
      setError(problem)
      return
    }
    setError(null)
    setFile(selected)
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <img
          src={preview}
          alt="Vista previa de la portada nueva"
          className="aspect-[16/9] w-full max-w-sm rounded-[14px] border object-cover"
          style={{ borderColor: 'var(--ps-line-strong)' }}
        />
      ) : (
        <StoryCover
          id={story.id}
          title={story.title}
          coverUrl={story.coverUrl}
          mode={story.mode}
          className="aspect-[16/9] w-full max-w-sm rounded-[14px] border border-[color:var(--ps-line-strong)]"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {file ? (
          <>
            <Button variant="brand" size="sm" disabled={busy} onClick={() => upload.mutate(file)}>
              <Icon icon={IconPortada} size={14} />
              {upload.isPending ? 'Subiendo…' : 'Guardar portada'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                reset()
                inputRef.current?.focus()
              }}
            >
              Descartar
            </Button>
          </>
        ) : null}

        {/* Input real (solo oculto a la vista): conserva teclado, etiqueta y lector de pantalla. */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={IMAGE_ACCEPT}
          className="peer sr-only"
          disabled={busy}
          onChange={onSelect}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
        />
        <label
          htmlFor={inputId}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-ink hover:bg-surf-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--ps-accent-text)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          {story.coverUrl || file ? 'Cambiar portada' : 'Subir portada'}
        </label>

        {story.coverUrl && !file ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate()}>
            <Icon icon={IconBorrar} size={14} />
            {remove.isPending ? 'Quitando…' : 'Quitar portada'}
          </Button>
        ) : null}
      </div>

      <p id={hintId} className="text-[12px] text-ink-faint">
        JPEG, PNG o WebP de hasta {COVER_MAX_MB} MB. Se ve mejor apaisada (unos 1600 × 900 px). Sin portada
        se dibuja un fondo propio a partir de la historia.
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
