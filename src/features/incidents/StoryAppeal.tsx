import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchMe, fetchMyIncidents, myIncidentsQueryKey } from '@/api/incidents'
import { fetchStory } from '@/api/stories'
import { IncidentAppeal } from '@/features/incidents/IncidentAppeal'
import { routes } from '@/router/paths'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

/** Bloque de apelación de una partida cerrada. Sin incidente (p. ej. ya caducado), no pinta nada. */
export function StoryAppeal({ storyId }: { storyId: string }) {
  const incidents = useQuery({ queryKey: myIncidentsQueryKey, queryFn: fetchMyIncidents })
  // La lista va de más reciente a más antiguo: el primero es el último cierre de esta partida.
  const incident = incidents.data?.find((item) => item.storyId === storyId)
  if (!incident) return null

  return (
    <Card className="p-4 sm:p-5">
      <section aria-labelledby="apelacion-titulo" className="flex flex-col gap-2">
        <h2 id="apelacion-titulo" className="font-serif text-headline-md text-ink">
          Apelación
        </h2>
        <IncidentAppeal incident={incident} acceptedAction={<ContinueReopened storyId={storyId} />} />
      </section>
    </Card>
  )
}

/** Tras aceptar, la partida puede estar reabierta; la de la caché aún dice «cerrada». */
function ContinueReopened({ storyId }: { storyId: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [notReopened, setNotReopened] = useState(false)

  async function onContinue() {
    setPending(true)
    try {
      const story = await queryClient.fetchQuery({ queryKey: ['story', storyId], queryFn: () => fetchStory(storyId), staleTime: 0 })
      void queryClient.invalidateQueries({ queryKey: ['stories'] })
      void queryClient.invalidateQueries({ queryKey: ['book'] })
      void fetchMe().catch(() => null)
      if (story.status === 'activa') navigate(routes.story(storyId))
      else setNotReopened(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="brand" className="self-start" disabled={pending} onClick={() => void onContinue()}>
        {pending ? 'Abriendo…' : 'Seguir la historia'}
      </Button>
      {notReopened ? (
        <p role="status" className="text-body-sm text-ink-dim">
          Esta partida no se ha podido reabrir porque ya tienes otra en curso del mismo libro.
        </p>
      ) : null}
    </div>
  )
}
