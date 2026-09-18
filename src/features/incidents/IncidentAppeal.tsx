import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Scale, XCircle } from 'lucide-react'
import {
  appealErrorMessage,
  appealIncident,
  APPEAL_MAX,
  meQueryKey,
  myIncidentsQueryKey,
  type MyIncident,
} from '@/api/incidents'
import { formatBookDate } from '@/features/book/format'
import { StoryField } from '@/features/customStories/StoryField'
import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'

export function levelLabel(level: string) {
  if (level === 'prohibido') return 'Contenido prohibido'
  if (level === 'explicito') return 'Contenido explícito'
  if (level === 'sensual') return 'Contenido sensual'
  return 'Sin clasificar'
}

function StatusLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-body-sm">
      <span className="mt-0.5 shrink-0 text-gold" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  )
}

type IncidentAppealProps = {
  incident: MyIncident
  /** Solo en la partida: qué hacer cuando la revisión la ha reabierto. */
  acceptedAction?: ReactNode
}

/**
 * Apelación de un cierre: el botón, el formulario y, después, en qué estado está. Se usa en la
 * partida cerrada y en la lista de incidentes que cuentan para la restricción.
 */
export function IncidentAppeal({ incident, acceptedAction }: IncidentAppealProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [announce, setAnnounce] = useState('')
  const fieldId = useId()
  const openerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // Al abrir, el foco va al texto; al cancelar, vuelve a «Apelar».
  useEffect(() => {
    if (open) document.getElementById(fieldId)?.focus()
    else if (wasOpen.current) openerRef.current?.focus()
    wasOpen.current = open
  }, [open, fieldId])

  const appeal = useMutation({
    mutationFn: () => appealIncident(incident.id, text),
    onSuccess: (updated) => {
      queryClient.setQueryData<MyIncident[]>(myIncidentsQueryKey, (list) =>
        list?.map((item) => (item.id === updated.id ? updated : item)),
      )
      void queryClient.invalidateQueries({ queryKey: myIncidentsQueryKey })
      void queryClient.invalidateQueries({ queryKey: meQueryKey })
      setOpen(false)
      setText('')
      setAnnounce('Apelación enviada. Una persona del equipo la revisará.')
    },
    // Ya apelado o ya resuelto (p. ej. desde otra pestaña): la lista trae el estado real.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) void queryClient.invalidateQueries({ queryKey: myIncidentsQueryKey })
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (text.length > APPEAL_MAX || appeal.isPending) return
    appeal.mutate()
  }

  let body: ReactNode
  if (incident.appealStatus === 'pendiente') {
    body = (
      <>
        <StatusLine icon={<Clock size={16} />}>
          <strong className="text-ink">Apelación pendiente.</strong>{' '}
          <span className="text-ink-dim">
            La enviaste {incident.appealedAt ? `el ${formatBookDate(incident.appealedAt)}` : 'hace poco'}. Una persona del equipo la
            revisará.
          </span>
        </StatusLine>
        {incident.appealText ? (
          <blockquote className="ml-6 border-l-2 border-[color:var(--ps-line-strong)] pl-3 text-body-sm break-words text-ink-dim">
            {incident.appealText}
          </blockquote>
        ) : null}
      </>
    )
  } else if (incident.appealStatus === 'aceptada') {
    body = (
      <>
        <StatusLine icon={<CheckCircle2 size={16} />}>
          <strong className="text-ink">Apelación aceptada.</strong>{' '}
          <span className="text-ink-dim">Te hemos dado la razón: este cierre ya no cuenta para la restricción.</span>
        </StatusLine>
        {incident.reviewNote ? <ReviewNote note={incident.reviewNote} /> : null}
        {acceptedAction ? <div className="ml-6">{acceptedAction}</div> : null}
      </>
    )
  } else if (incident.appealStatus === 'rechazada') {
    body = (
      <>
        <StatusLine icon={<XCircle size={16} />}>
          <strong className="text-ink">Apelación rechazada.</strong>{' '}
          <span className="text-ink-dim">Revisamos el cierre y se mantiene.</span>
        </StatusLine>
        {incident.reviewNote ? <ReviewNote note={incident.reviewNote} /> : null}
      </>
    )
  } else if (!open) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-ink-dim">
          <strong className="text-ink">¿Crees que fue un error?</strong> Puedes apelar una vez y una persona lo revisará.
        </p>
        <Button
          ref={openerRef}
          size="sm"
          variant="outline"
          onClick={() => {
            appeal.reset()
            setOpen(true)
          }}
        >
          <Scale size={14} aria-hidden />
          Apelar
        </Button>
      </div>
    )
  } else {
    body = (
      <form onSubmit={onSubmit} noValidate aria-label="Apelación" className="flex flex-col gap-1">
        <p className="mb-2 text-body-sm text-ink-dim">
          <strong className="text-ink">¿Crees que fue un error?</strong> Cuéntanos qué pasó. Es opcional, y solo se puede apelar una vez.
        </p>
        <StoryField
          id={fieldId}
          label="Tu explicación (opcional)"
          value={text}
          onChange={setText}
          multiline
          rows={3}
          maxLength={APPEAL_MAX}
          enforceMaxLength={false}
          hint={`Hasta ${APPEAL_MAX} caracteres. La leerá una persona del equipo.`}
          error={text.length > APPEAL_MAX ? `Sobran ${text.length - APPEAL_MAX} caracteres.` : undefined}
          className="mb-2"
        />
        {appeal.isError ? (
          <p role="alert" className="mb-2 text-body-sm text-error">
            {appealErrorMessage(appeal.error)}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={appeal.isPending}
            onClick={() => {
              setOpen(false)
              appeal.reset()
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="brand" size="sm" disabled={appeal.isPending || text.length > APPEAL_MAX}>
            {appeal.isPending ? 'Enviando…' : 'Enviar apelación'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {body}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  )
}

function ReviewNote({ note }: { note: string }) {
  return (
    <p className="ml-6 text-body-sm break-words text-ink-dim">
      <span className="font-semibold text-ink">Nota del equipo:</span> {note}
    </p>
  )
}
