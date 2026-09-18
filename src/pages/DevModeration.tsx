import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  fetchIncident,
  fetchIncidentQueue,
  resolveIncident,
  REVIEW_NOTE_MAX,
  type DevIncident,
  type ModerationFilter,
} from '@/api/dev'
import { activeRestriction, formatRestrictedUntil } from '@/api/policy'
import { StoryField } from '@/features/customStories/StoryField'
import { DevSubnav } from '@/features/dev/DevSubnav'
import { levelLabel } from '@/features/incidents/IncidentAppeal'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { useAuthStore } from '@/stores/authStore'

const PAGE_SIZE = 20

const FILTERS: { id: ModerationFilter; label: string }[] = [
  { id: 'pendientes', label: 'Apelaciones pendientes' },
  { id: 'sin_resolver', label: 'Sin resolver' },
  { id: 'recientes', label: 'Últimos 30 días' },
  { id: 'resueltos', label: 'Resueltos' },
  { id: 'todos', label: 'Todos' },
]

const LEVELS = [
  { id: '', label: 'Todos los niveles' },
  { id: 'explicito', label: 'Explícito' },
  { id: 'prohibido', label: 'Prohibido' },
  { id: 'sensual', label: 'Sensual' },
]

const selectClassName =
  'h-11 w-full min-w-0 rounded-xl border border-[color:var(--ps-line-strong)] bg-surf-1 px-3 text-body-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]'
const labelClassName = 'text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase'

const devIncidentsKey = ['dev', 'incidents'] as const

function isFilter(value: string | null): value is ModerationFilter {
  return FILTERS.some((f) => f.id === value)
}

function appealLabel(incident: DevIncident) {
  if (incident.review) return incident.review.status === 'aceptada' ? 'Aceptado' : 'Rechazado'
  if (incident.appealStatus === 'pendiente') return 'Apelación pendiente'
  return 'Sin apelar'
}

function formatWhen(value: string | null | undefined) {
  return value ? formatRestrictedUntil(value) : '—'
}

/** Cola de incidentes de conducta para quien revisa. Solo cuentas dev (la API da 403 al resto). */
export default function DevModerationPage() {
  const isDev = useAuthStore((s) => Boolean(s.user?.isDev))
  const [params, setParams] = useSearchParams()
  const filter: ModerationFilter = isFilter(params.get('filtro')) ? (params.get('filtro') as ModerationFilter) : 'pendientes'
  const level = params.get('nivel') ?? ''
  const rule = params.get('regla') ?? ''
  const page = Math.max(0, Number(params.get('pagina') ?? '0') || 0)
  const selectedId = Number(params.get('incidente')) || null
  const [ruleDraft, setRuleDraft] = useState(rule)
  const filterId = useId()
  const levelId = useId()
  const ruleId = useId()

  function update(changes: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (resetPage) next.delete('pagina')
    setParams(next, { replace: true })
  }

  // La regla se aplica al dejar de escribir, no en cada tecla.
  useEffect(() => {
    if (ruleDraft === rule) return
    const timer = window.setTimeout(() => update({ regla: ruleDraft.trim() || null }), 350)
    return () => window.clearTimeout(timer)
  }, [ruleDraft])

  const queue = useQuery({
    queryKey: [...devIncidentsKey, 'queue', { filter, level, rule, page }],
    queryFn: () => fetchIncidentQueue({ filter, level, rule, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: isDev,
  })

  if (!isDev) return <Navigate to={routes.characters} replace />

  const total = queue.data?.total ?? 0
  const items = queue.data?.items ?? []
  const from = total ? page * PAGE_SIZE + 1 : 0
  const to = Math.min(total, (page + 1) * PAGE_SIZE)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-display text-ink">Moderación</h1>
        <p className="text-body-sm text-ink-dim">
          Incidentes de conducta de todas las cuentas. Aceptar anula el cierre (deja de contar y reabre la partida si se puede);
          rechazar lo mantiene.
        </p>
      </header>

      <DevSubnav />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="cola-titulo" className="min-w-0 space-y-4">
          <h2 id="cola-titulo" className="sr-only">
            Cola de incidentes
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={filterId} className={labelClassName}>
                Mostrar
              </label>
              <select id={filterId} value={filter} onChange={(e) => update({ filtro: e.target.value, incidente: null })} className={selectClassName}>
                {FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={levelId} className={labelClassName}>
                Nivel
              </label>
              <select id={levelId} value={level} onChange={(e) => update({ nivel: e.target.value || null })} className={selectClassName}>
                {LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={ruleId} className={labelClassName}>
                Regla (prefijo)
              </label>
              <input
                id={ruleId}
                type="search"
                value={ruleDraft}
                placeholder="p. ej. llm:"
                onChange={(e) => setRuleDraft(e.target.value)}
                className={selectClassName}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <p role="status" aria-live="polite" className="text-body-sm text-ink-dim">
            {queue.isPending ? 'Cargando…' : queue.isError ? '' : total ? `${from}–${to} de ${total}` : 'No hay incidentes con estos filtros.'}
          </p>
          {queue.isError ? (
            <p role="alert" className="text-body-sm text-error">
              {queue.error instanceof ApiError ? queue.error.message : 'No se pudo cargar la cola.'}
            </p>
          ) : null}

          {items.length ? (
            <ul className="flex flex-col gap-2" aria-busy={queue.isFetching}>
              {items.map((incident) => (
                <li key={incident.id}>
                  <QueueRow
                    incident={incident}
                    selected={incident.id === selectedId}
                    onSelect={() => update({ incidente: String(incident.id) }, false)}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {total > PAGE_SIZE ? (
            <nav aria-label="Páginas de la cola" className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => update({ pagina: page > 1 ? String(page - 1) : null }, false)}>
                Anterior
              </Button>
              <span className="text-body-sm text-ink-dim">
                Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}
              </span>
              <Button size="sm" variant="outline" disabled={to >= total} onClick={() => update({ pagina: String(page + 1) }, false)}>
                Siguiente
              </Button>
            </nav>
          ) : null}
        </section>

        <div className="min-w-0 lg:sticky lg:top-0">
          {selectedId ? (
            <IncidentDetail key={selectedId} id={selectedId} onClose={() => update({ incidente: null }, false)} />
          ) : (
            <Card className="p-5">
              <p className="text-body-sm text-ink-dim">Elige un incidente de la cola para ver el detalle y revisarlo.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function QueueRow({ incident, selected, onSelect }: { incident: DevIncident; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full min-w-0 flex-col gap-1 rounded-xl border px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]',
        selected ? 'border-[color:var(--ps-primary)] bg-surf-2' : 'border-[color:var(--ps-line)] bg-surf-1 hover:bg-surf-2',
      )}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
        <span className="font-semibold text-ink">#{incident.id}</span>
        <span className="text-ink-dim">{formatWhen(incident.createdAt)}</span>
        <Badge variant="outline" className="tracking-normal">
          {levelLabel(incident.level)}
        </Badge>
      </span>
      <span className="min-w-0 text-body-sm break-words text-ink">
        {incident.user ? `@${incident.user.handle}` : 'Cuenta borrada'} · {incident.story?.bookTitle ?? 'Partida borrada'}
      </span>
      <span className="text-[12px] break-all text-ink-dim">
        {incident.rule ?? 'sin regla'} · {appealLabel(incident)}
      </span>
    </button>
  )
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className={labelClassName}>{term}</dt>
      <dd className="min-w-0 text-body-sm break-words text-ink">{children}</dd>
    </div>
  )
}

function reviewBlockReason(incident: DevIncident, myHandle: string | undefined) {
  if (incident.review) {
    const who = incident.review.reviewedBy ? ` por @${incident.review.reviewedBy}` : ''
    return `Ya revisado${who} el ${formatWhen(incident.review.reviewedAt)}.`
  }
  if (incident.user && myHandle && incident.user.handle === myHandle) {
    return 'Es un incidente tuyo: tiene que revisarlo otra persona.'
  }
  return 'No puedes revisar este incidente (es tuyo o ya está revisado).'
}

function IncidentDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const myHandle = useAuthStore((s) => s.user?.handle)
  const detailKey = [...devIncidentsKey, 'detail', id]
  const detail = useQuery({ queryKey: detailKey, queryFn: () => fetchIncident(id) })
  const [note, setNote] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const noteId = useId()
  const reasonId = useId()

  // Al elegir otro incidente el foco salta aquí (en móvil el detalle queda debajo de la cola).
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const resolve = useMutation({
    mutationFn: (decision: 'accept' | 'reject') => resolveIncident(id, decision, note),
    onSuccess: ({ incident, storyReopened }, decision) => {
      queryClient.setQueryData(detailKey, incident)
      void queryClient.invalidateQueries({ queryKey: [...devIncidentsKey, 'queue'] })
      void queryClient.invalidateQueries({ queryKey: ['stories'] })
      if (incident.story) void queryClient.invalidateQueries({ queryKey: ['story', incident.story.id] })
      setNote('')
      setResult(
        decision === 'accept'
          ? `Incidente aceptado: deja de contar. ${storyReopened ? 'La partida se ha reabierto.' : 'La partida no se ha reabierto (no estaba cerrada, se borró o ya hay otra en curso del mismo libro).'}`
          : 'Incidente rechazado: el cierre se mantiene.',
      )
    },
    // Propio o ya resuelto por otra persona: se vuelve a pedir para enseñar el estado real.
    onError: () => void queryClient.invalidateQueries({ queryKey: detailKey }),
  })

  const incident = detail.data
  const restrictedUntil = activeRestriction(incident?.user?.restrictedUntil)

  return (
    <Card className="p-5">
      <section aria-labelledby={`incidente-${id}`} className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`incidente-${id}`} ref={headingRef} tabIndex={-1} className="font-serif text-headline-md text-ink outline-none">
            Incidente #{id}
          </h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cerrar detalle
          </Button>
        </div>

        {detail.isPending ? <p className="text-body-sm text-ink-dim">Cargando…</p> : null}
        {detail.isError ? (
          <p role="alert" className="text-body-sm text-error">
            {detail.error instanceof ApiError ? detail.error.message : 'No se pudo cargar el incidente.'}
          </p>
        ) : null}

        {incident ? (
          <>
            <dl className="flex flex-col gap-2">
              <Row term="Fecha">{formatWhen(incident.createdAt)}</Row>
              <Row term="Nivel">{levelLabel(incident.level)}</Row>
              <Row term="Regla">
                <code className="break-all">{incident.rule ?? '—'}</code>
              </Row>
              <Row term="Usuario">
                {incident.user ? (
                  <>
                    <Link to={routes.profile(incident.user.handle)} className="font-semibold text-accent-text underline">
                      @{incident.user.handle}
                    </Link>{' '}
                    <span className="text-ink-dim">({incident.user.username})</span>
                  </>
                ) : (
                  'Cuenta borrada'
                )}
              </Row>
              <Row term="Restricción">{restrictedUntil ? `Hasta el ${formatRestrictedUntil(restrictedUntil)}` : 'Sin restricción'}</Row>
              <Row term="Partida">
                {incident.story ? `${incident.story.bookTitle} · ${incident.story.status}` : 'Partida borrada'}
              </Row>
              <Row term="Apelación">
                {incident.appealStatus
                  ? `${incident.appealStatus === 'pendiente' ? 'Pendiente' : incident.appealStatus === 'aceptada' ? 'Aceptada' : 'Rechazada'} · ${formatWhen(incident.appealedAt)}`
                  : 'Sin apelar'}
              </Row>
              {incident.review ? (
                <Row term="Revisión">
                  {incident.review.status === 'aceptada' ? 'Aceptado' : 'Rechazado'}
                  {incident.review.reviewedBy ? ` por @${incident.review.reviewedBy}` : ''} · {formatWhen(incident.review.reviewedAt)}
                  {incident.review.note ? <span className="mt-1 block text-ink-dim">Nota: {incident.review.note}</span> : null}
                </Row>
              ) : null}
            </dl>

            <section aria-labelledby={`extracto-${id}`} className="flex flex-col gap-2">
              <h3 id={`extracto-${id}`} className={labelClassName}>
                Extracto
              </h3>
              {incident.excerpt ? (
                <>
                  <p className="flex items-start gap-2 text-[12px] text-ink-dim">
                    <ShieldAlert size={14} aria-hidden className="mt-0.5 shrink-0 text-gold" />
                    Confidencial: solo para revisar este incidente. Se borra a los 30 días o al resolverlo.
                  </p>
                  <blockquote
                    tabIndex={0}
                    className="max-h-48 overflow-auto rounded-lg border border-[color:var(--ps-line)] bg-surf-1 p-3 text-body-sm whitespace-pre-wrap break-words text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]"
                  >
                    {incident.excerpt}
                  </blockquote>
                </>
              ) : (
                <p className="text-body-sm text-ink-dim">Sin extracto (caducado o resuelto).</p>
              )}
            </section>

            <section aria-labelledby={`apelacion-${id}`} className="flex flex-col gap-2">
              <h3 id={`apelacion-${id}`} className={labelClassName}>
                Texto de la apelación
              </h3>
              <p className="text-body-sm whitespace-pre-wrap break-words text-ink">
                {incident.appealText ?? <span className="text-ink-dim">{incident.appealStatus ? 'Apeló sin texto.' : 'No ha apelado.'}</span>}
              </p>
            </section>

            <div className="flex flex-col gap-2 border-t border-[color:var(--ps-line)] pt-4">
              {incident.canReview ? (
                <StoryField
                  id={noteId}
                  label="Nota para la cuenta (opcional)"
                  value={note}
                  onChange={setNote}
                  multiline
                  rows={2}
                  maxLength={REVIEW_NOTE_MAX}
                  enforceMaxLength={false}
                  hint={`Hasta ${REVIEW_NOTE_MAX} caracteres. La verá quien apeló.`}
                  error={note.length > REVIEW_NOTE_MAX ? `Sobran ${note.length - REVIEW_NOTE_MAX} caracteres.` : undefined}
                  className="mb-1"
                />
              ) : (
                <p id={reasonId} className="text-body-sm text-ink-dim">
                  {reviewBlockReason(incident, myHandle)}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={!incident.canReview || resolve.isPending || note.length > REVIEW_NOTE_MAX}
                  aria-describedby={incident.canReview ? undefined : reasonId}
                  onClick={() => resolve.mutate('reject')}
                >
                  Rechazar
                </Button>
                <Button
                  variant="brand"
                  disabled={!incident.canReview || resolve.isPending || note.length > REVIEW_NOTE_MAX}
                  aria-describedby={incident.canReview ? undefined : reasonId}
                  onClick={() => resolve.mutate('accept')}
                >
                  Aceptar
                </Button>
              </div>
              {resolve.isError ? (
                <p role="alert" className="text-body-sm text-error">
                  {resolve.error instanceof ApiError ? resolve.error.message : 'No se pudo guardar la revisión.'}
                </p>
              ) : null}
              <p role="status" aria-live="polite" className="text-body-sm text-ink">
                {result ?? ''}
              </p>
            </div>
          </>
        ) : null}
      </section>
    </Card>
  )
}
