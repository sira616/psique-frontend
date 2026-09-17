import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ImageUp, Trash2 } from 'lucide-react'
import {
  deleteProfileImage,
  profileFieldErrors,
  profileGeneralError,
  uploadProfileImage,
  type ImageKind,
  type MyProfile,
} from '@/api/profile'
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES, imageProblem } from '@/features/profile/limits'
import { mediaUrl } from '@/shared/lib/media'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/button'

type ProfileImageFieldProps = {
  kind: ImageKind
  profile: MyProfile
  /** Recibe el perfil nuevo tras subir o quitar. */
  onChanged: (profile: MyProfile) => void
  onAnnounce: (message: string) => void
}

const COPY: Record<ImageKind, { label: string; name: string; article: string }> = {
  avatar: { label: 'Foto de perfil', name: 'foto', article: 'la foto' },
  banner: { label: 'Banner', name: 'banner', article: 'el banner' },
}

/** Elegir → previsualizar → subir. Quitar borra la imagen actual en el servidor. */
export function ProfileImageField({ kind, profile, onChanged, onAnnounce }: ProfileImageFieldProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[kind]
  // Los botones de confirmar desaparecen al terminar: el foco vuelve al selector de archivo.
  const refocusInput = useRef(false)
  const currentUrl = kind === 'avatar' ? profile.avatarUrl : profile.bannerUrl

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
    mutationFn: (selected: File) => uploadProfileImage(kind, selected),
    onSuccess: (next) => {
      reset()
      setError(null)
      refocusInput.current = true
      onChanged(next)
      onAnnounce(kind === 'avatar' ? 'Foto de perfil actualizada.' : 'Banner actualizado.')
    },
    onError: (err) => {
      setError(profileFieldErrors(err).file ?? profileGeneralError(err, `No se pudo subir ${copy.article}.`))
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteProfileImage(kind),
    onSuccess: () => {
      setError(null)
      onChanged({ ...profile, [kind === 'avatar' ? 'avatarUrl' : 'bannerUrl']: null })
      onAnnounce(kind === 'avatar' ? 'Foto de perfil quitada.' : 'Banner quitado.')
      refocusInput.current = true
    },
    onError: (err) => setError(profileGeneralError(err, `No se pudo quitar ${copy.article}.`)),
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
    const problem = imageProblem(kind, selected)
    if (problem) {
      reset()
      setError(problem)
      return
    }
    setError(null)
    setFile(selected)
  }

  const shownUrl = preview ?? mediaUrl(currentUrl)
  const maxMb = IMAGE_MAX_BYTES[kind] / (1024 * 1024)

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">{copy.label}</h3>

      {kind === 'banner' ? (
        <div
          className="aspect-[4/1] w-full overflow-hidden rounded-[14px] border"
          style={{
            borderColor: 'var(--ps-line-strong)',
            background: 'linear-gradient(120deg, var(--ps-primary-deep), var(--ps-surf-3) 60%, var(--ps-gold))',
          }}
        >
          {shownUrl ? (
            <img
              src={shownUrl}
              alt={preview ? 'Vista previa del banner nuevo' : 'Banner actual'}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      ) : preview ? (
        <span className="inline-block h-24 w-24 overflow-hidden rounded-full">
          <img src={preview} alt="Vista previa de la foto nueva" className="h-full w-full object-cover" />
        </span>
      ) : (
        <Avatar name={profile.displayName} url={currentUrl} size="lg" alt="Foto de perfil actual" className="h-24 w-24 sm:h-24 sm:w-24" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {file ? (
          <>
            <Button variant="brand" size="sm" disabled={busy} onClick={() => upload.mutate(file)}>
              <ImageUp size={14} aria-hidden />
              {upload.isPending ? 'Subiendo…' : `Guardar ${copy.name}`}
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
          {currentUrl || file ? `Cambiar ${copy.name}` : `Subir ${copy.name}`}
        </label>

        {currentUrl && !file ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate()}>
            <Trash2 size={14} aria-hidden />
            {remove.isPending ? 'Quitando…' : `Quitar ${copy.name}`}
          </Button>
        ) : null}
      </div>

      <p id={hintId} className="text-[12px] text-ink-faint">
        JPEG, PNG o WebP de hasta {maxMb} MB.
        {kind === 'banner' ? ' Se ve mejor apaisado (unos 1600 × 400 px).' : ' Se recorta en círculo.'}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
