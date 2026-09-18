import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { fetchMe, fetchMyIncidents, meQueryKey, myIncidentsQueryKey } from '@/api/incidents'
import { formatBookDate } from '@/features/book/format'
import { IncidentAppeal, levelLabel } from '@/features/incidents/IncidentAppeal'
import { routes } from '@/router/paths'

/**
 * Los cierres que cuentan para la restricción, cada uno con su apelación. Va en Configuración
 * (`/configuracion#incidentes`), a donde enlazan los avisos de cuenta restringida.
 */
export function RestrictionIncidents() {
  const incidents = useQuery({ queryKey: myIncidentsQueryKey, queryFn: fetchMyIncidents })
  // Una revisión aceptada puede haber levantado la restricción desde que se abrió la sesión.
  useQuery({ queryKey: meQueryKey, queryFn: fetchMe })
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { hash } = useLocation()
  const counting = incidents.data?.filter((item) => item.counts) ?? []

  // El enlace del aviso trae #incidentes: en una SPA el navegador no baja solo hasta aquí.
  const ready = Boolean(incidents.data)
  useEffect(() => {
    if (hash !== '#incidentes' || !ready) return
    headingRef.current?.scrollIntoView?.({ block: 'start' })
    headingRef.current?.focus()
  }, [hash, ready])

  return (
    <section aria-labelledby="incidentes" className="mt-4 flex flex-col gap-3">
      <h3 id="incidentes" ref={headingRef} tabIndex={-1} className="font-serif text-headline-md text-ink outline-none">
        Cierres que cuentan
      </h3>
      {incidents.isPending ? <p className="text-body-sm text-ink-dim">Cargando…</p> : null}
      {incidents.isError ? (
        <p role="alert" className="text-body-sm text-error">
          No se pudieron cargar tus incidentes.
        </p>
      ) : null}
      {incidents.data && !counting.length ? (
        <p className="text-body-sm text-ink-dim">Ningún cierre cuenta ahora mismo para la restricción.</p>
      ) : null}
      {counting.length ? (
        <ul className="flex flex-col gap-3">
          {counting.map((incident) => (
            <li
              key={incident.id}
              className="flex flex-col gap-2 rounded-xl p-3.5"
              style={{ background: 'var(--ps-surf-2)', border: '1px solid var(--ps-line)' }}
            >
              <p className="text-body-sm">
                <Link to={routes.storyArchive(incident.storyId)} className="font-semibold break-words text-accent-text underline">
                  {incident.bookTitle}
                </Link>
                <span className="text-ink-dim">
                  {' '}
                  · {formatBookDate(incident.createdAt)} · {levelLabel(incident.level)}
                </span>
              </p>
              <IncidentAppeal incident={incident} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
