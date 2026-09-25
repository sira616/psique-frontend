import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  customStoryQueryKey,
  customStoryQueryKeys,
  updateCustomStory,
  type CustomStory,
  type CustomStoryPatch,
} from '@/api/customStories'
import { ApiError } from '@/shared/lib/apiClient'
import { Switch } from '@/shared/ui/Switch'

/** Los tres campos de sí o no: un PATCH de un solo campo, sin nada que validar. */
type ToggleField = Extract<keyof CustomStoryPatch, 'isPublic' | 'freeFirstRead' | 'adult'>

const TOGGLES: Record<
  ToggleField,
  { label: string; help: string; on: string; off: string; failure: string }
> = {
  isPublic: {
    label: 'Publicada en Explorar',
    help: 'Cuando es pública aparece en Explorar y cualquiera puede empezarla.',
    on: 'Ahora es pública y aparece en Explorar.',
    off: 'Ahora es privada: ya no aparece en Explorar.',
    failure: 'No se pudo cambiar la visibilidad.',
  },
  freeFirstRead: {
    label: 'Primera lectura gratis',
    help: 'Cada lectora empieza gratis; releer cuesta óbolos de todos modos.',
    on: 'La primera lectura ahora es gratis.',
    off: 'Ahora leerla cuesta óbolos desde la primera vez.',
    failure: 'No se pudo cambiar el precio de lectura.',
  },
  adult: {
    label: '+18',
    help: 'Solo la verán cuentas que han confirmado ser mayores de edad. Las escenas íntimas siguen con fundido a negro.',
    on: 'Ahora es +18: solo la verán cuentas mayores de edad.',
    off: 'Ya no es +18: la puede ver cualquier cuenta.',
    failure: 'No se pudo cambiar la opción +18.',
  },
}

/**
 * Un campo por interruptor, guardado al momento y de forma optimista: son valores reversibles
 * y sin texto que validar, así que pedir un botón de guardar solo estorbaría. Si el servidor
 * lo rechaza, el interruptor vuelve a donde estaba y se dice por qué.
 */
function StoryToggle({ story, field }: { story: CustomStory; field: ToggleField }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const copy = TOGGLES[field]
  const queryKey = customStoryQueryKey(story.id)
  const labelId = `${field}-label`
  const helpId = `${field}-help`

  const toggle = useMutation({
    mutationFn: (value: boolean) => updateCustomStory(story.id, { [field]: value }),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CustomStory>(queryKey)
      queryClient.setQueryData<CustomStory>(queryKey, (current) =>
        current ? { ...current, [field]: value } : current,
      )
      setStatus('')
      return { previous }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated)
      setStatus(updated[field] ? copy.on : copy.off)
      for (const key of customStoryQueryKeys) void queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (_error, _value, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
  })

  return (
    <div
      className="space-y-1 rounded-[14px] border p-3"
      style={{ borderColor: 'var(--ps-line-strong)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={labelId} className="font-semibold text-ink">
            {copy.label}
          </p>
          <p id={helpId} className="text-body-sm text-ink-dim">
            {copy.help}
          </p>
        </div>
        <Switch
          checked={story[field]}
          aria-labelledby={labelId}
          aria-describedby={helpId}
          onCheckedChange={(next) => toggle.mutate(next)}
        />
      </div>
      <p aria-live="polite" className="text-[13px] text-ink-dim empty:hidden">
        {toggle.isError ? '' : status}
      </p>
      {toggle.isError ? (
        <p role="alert" className="text-[13px] text-error">
          {toggle.error instanceof ApiError ? toggle.error.message : copy.failure}
        </p>
      ) : null}
    </div>
  )
}

export function StoryVisibilitySettings({ story }: { story: CustomStory }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <StoryToggle story={story} field="isPublic" />
      <StoryToggle story={story} field="freeFirstRead" />
      <StoryToggle story={story} field="adult" />
    </div>
  )
}
