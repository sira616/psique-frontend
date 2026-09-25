import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  customStoryFieldErrors,
  customStoryQueryKey,
  customStoryQueryKeys,
  updateCustomStory,
  type CustomStory,
  type CustomStoryPatch,
} from '@/api/customStories'
import {
  AGE_MAX,
  AGE_MIN,
  EDIT_LIMITS,
  NAME_PATTERN,
  ageProblem,
  textProblem,
  type EditField,
  type FieldErrors,
  type TextLimit,
} from '@/features/customStories/limits'
import { StoryField } from '@/features/customStories/StoryField'
import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'
import { Icon, IconAviso } from '@/shared/ui/icons'

type FieldSpec = {
  field: EditField
  label: string
  hint?: string
  multiline?: boolean
  rows?: number
  /** Ocupa toda la fila en la rejilla de dos columnas. */
  wide?: boolean
  /** false: deja pegar de más y marca el contador, en vez de recortar en silencio. */
  enforceMaxLength?: boolean
}

const HISTORIA_FIELDS: FieldSpec[] = [
  { field: 'title', label: 'Título', wide: true },
  {
    field: 'hook',
    label: 'Gancho',
    hint: 'La frase que se lee en Explorar y en las tarjetas. Entre 10 y 140 caracteres.',
    multiline: true,
    rows: 2,
    wide: true,
  },
  {
    field: 'description',
    label: 'Descripción',
    hint: 'Opcional: lo que verá quien abra el libro. Vacía, no se enseña. Como mucho 1000 caracteres.',
    multiline: true,
    rows: 5,
    wide: true,
    // Una descripción suele venir pegada de otro sitio: recortarla sin avisar es peor que marcarla.
    enforceMaxLength: false,
  },
  { field: 'tone', label: 'Tono', hint: 'Opcional. Entre 3 y 60 caracteres.' },
]

const PERSONAJE_FIELDS: FieldSpec[] = [
  { field: 'name', label: 'Nombre del personaje' },
  { field: 'age', label: 'Edad', hint: `Entre ${AGE_MIN} y ${AGE_MAX} años.` },
  {
    field: 'personality',
    label: 'Personalidad',
    hint: 'Rasgos separados por comas. Entre 3 y 300 caracteres.',
    multiline: true,
    rows: 2,
    wide: true,
  },
  { field: 'speakingStyle', label: 'Forma de hablar', multiline: true, rows: 2, wide: true },
  {
    field: 'setting',
    label: 'Escenario inicial',
    hint: 'La primera escena de la historia. Entre 20 y 590 caracteres.',
    multiline: true,
    rows: 3,
    wide: true,
  },
  { field: 'backstory', label: 'Pasado del personaje', multiline: true, rows: 4, wide: true },
]

type Values = Partial<Record<EditField, string>>

/** Valor guardado de un campo: los del personaje viven dentro de `definition`. */
function valueOf(story: CustomStory, field: EditField): string {
  switch (field) {
    case 'title':
      return story.title
    case 'hook':
      return story.hook
    case 'description':
      return story.description ?? ''
    case 'tone':
      return story.tone ?? ''
    case 'age':
      return story.definition ? String(story.definition.age) : ''
    default:
      return story.definition?.[field] ?? ''
  }
}

function valuesOf(story: CustomStory, specs: FieldSpec[]): Values {
  const values: Values = {}
  for (const { field } of specs) values[field] = valueOf(story, field)
  return values
}

function problemOf(field: EditField, value: string): string | null {
  if (field === 'age') return ageProblem(value)
  const problem = textProblem(value, EDIT_LIMITS[field])
  if (problem) return problem
  if (field === 'name' && !NAME_PATTERN.test(value.trim())) {
    return 'Solo letras, espacios, apóstrofos, puntos y guiones.'
  }
  return null
}

/** Solo lo que cambia: el backend exige al menos un campo y rechaza el PATCH entero si uno falla. */
function patchOf(values: Values, initial: Values, specs: FieldSpec[]): CustomStoryPatch {
  const patch: CustomStoryPatch = {}
  for (const { field } of specs) {
    const value = (values[field] ?? '').trim()
    if (value === (initial[field] ?? '').trim()) continue
    if (field === 'age') patch.age = Number(value)
    // Vaciarlos los borra; el backend admite null en los dos.
    else if (field === 'description' || field === 'tone') patch[field] = value || null
    else patch[field] = value
  }
  return patch
}

type StoryEditFormProps = {
  story: CustomStory
  specs: FieldSpec[]
  formId: string
  /** Texto que se anuncia y se enseña al guardar bien. */
  savedMessage: string
  notice?: ReactNode
}

/**
 * Formulario con guardado explícito, no campo a campo. El PATCH del backend es todo o nada (si
 * un campo falla no se guarda ninguno), así que un botón por grupo de campos describe lo que
 * pasa de verdad; guardar al salir de cada campo soltaría una petición por tecleo y dejaría al
 * lector sin saber qué se guardó cuando el filtro de contenido rechaza el conjunto.
 */
function StoryEditForm({ story, specs, formId, savedMessage, notice }: StoryEditFormProps) {
  const queryClient = useQueryClient()
  const initial = useMemo(() => valuesOf(story, specs), [story, specs])
  const [values, setValues] = useState<Values>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  // El fieldset se deshabilita mientras guarda y un control deshabilitado no puede recibir el
  // foco: se apunta el campo y se enfoca cuando el formulario vuelve a estar activo.
  const [focusField, setFocusField] = useState<EditField | null>(null)

  // Al llegar la historia desde el servidor (o tras guardar) los campos parten de lo guardado.
  useEffect(() => {
    setValues(initial)
  }, [initial])

  const save = useMutation({
    mutationFn: (patch: CustomStoryPatch) => updateCustomStory(story.id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(customStoryQueryKey(story.id), updated)
      for (const key of customStoryQueryKeys) void queryClient.invalidateQueries({ queryKey: key })
      setErrors({})
      setGeneralError(null)
      setStatus(savedMessage)
    },
    onError: (error) => {
      const fieldErrors = customStoryFieldErrors(error)
      setErrors(fieldErrors)
      // 422 con detail en texto (filtro de contenido, personaje en modo concepto): sin campo al
      // que señalar, va al aviso general del formulario.
      setGeneralError(
        Object.keys(fieldErrors).length
          ? 'Revisa los campos marcados.'
          : error instanceof ApiError
            ? error.message
            : 'No se pudieron guardar los cambios.',
      )
      setStatus('')
      setFocusField(specs.find((spec) => fieldErrors[spec.field])?.field ?? null)
    },
  })

  const pending = save.isPending

  useEffect(() => {
    if (!focusField || save.isPending) return
    document.getElementById(focusField)?.focus()
    setFocusField(null)
  }, [focusField, save.isPending])
  const generalErrorId = `${formId}-error`
  const changed = Object.keys(patchOf(values, initial, specs)).length > 0

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const localErrors: FieldErrors = {}
    for (const { field } of specs) {
      const problem = problemOf(field, values[field] ?? '')
      if (problem) localErrors[field] = problem
    }
    setErrors(localErrors)
    setStatus('')
    if (Object.keys(localErrors).length) {
      setGeneralError('Revisa los campos marcados.')
      setFocusField(specs.find((spec) => localErrors[spec.field])?.field ?? null)
      return
    }
    const patch = patchOf(values, initial, specs)
    if (!Object.keys(patch).length) {
      setGeneralError(null)
      setStatus('No hay nada nuevo que guardar.')
      return
    }
    setGeneralError(null)
    save.mutate(patch)
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      aria-describedby={generalError ? generalErrorId : undefined}
    >
      {notice}
      <fieldset disabled={pending} className="md:grid md:grid-cols-2 md:gap-x-4">
        <legend className="sr-only">Campos que se pueden editar</legend>
        {specs.map((spec) => {
          const limit: TextLimit | null = spec.field === 'age' ? null : EDIT_LIMITS[spec.field]
          const shared = {
            id: spec.field,
            label: spec.label,
            value: values[spec.field] ?? '',
            onChange: (value: string) => setValues((prev) => ({ ...prev, [spec.field]: value })),
            error: errors[spec.field],
            hint: spec.hint,
            className: spec.wide ? 'md:col-span-2' : undefined,
          }
          if (spec.field === 'age') {
            return <StoryField key={spec.field} type="number" min={AGE_MIN} max={AGE_MAX} required {...shared} />
          }
          return (
            <StoryField
              key={spec.field}
              multiline={spec.multiline}
              rows={spec.rows}
              maxLength={limit!.max}
              enforceMaxLength={spec.enforceMaxLength}
              required={!limit!.optional}
              {...shared}
            />
          )
        })}
      </fieldset>

      {generalError ? (
        <p id={generalErrorId} role="alert" className="mb-3 text-[13px] text-error">
          {generalError}
        </p>
      ) : null}

      <p aria-live="polite" className="mb-3 text-body-sm text-ink-dim empty:hidden">
        {pending ? 'Guardando…' : status}
      </p>

      <Button type="submit" variant="brand" className="w-full sm:w-auto sm:min-w-56" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
      {/* Sin cambios el botón sigue activo (deshabilitarlo esconde el porqué); al pulsar se dice. */}
      {!changed && !pending ? (
        <p className="mt-2 text-[12px] text-ink-faint">Los campos están como se guardaron.</p>
      ) : null}
    </form>
  )
}

/** Título, gancho, descripción y tono: lo que se ve antes de empezar a leer. */
export function StoryDetailsForm({ story }: { story: CustomStory }) {
  return (
    <StoryEditForm
      story={story}
      specs={HISTORIA_FIELDS}
      formId="editar-historia"
      savedMessage="Cambios guardados."
    />
  )
}

/**
 * Perfil del personaje, solo en modo definida. Lleva el aviso de que esto alcanza a las
 * partidas que ya están en marcha.
 */
export function StoryCharacterForm({ story }: { story: CustomStory }) {
  return (
    <StoryEditForm
      story={story}
      specs={PERSONAJE_FIELDS}
      formId="editar-personaje"
      savedMessage="Personaje guardado."
      notice={
        <p
          className="mb-4 flex gap-2 rounded-[14px] border p-3 text-body-sm text-ink"
          style={{ borderColor: 'var(--ps-line-strong)', background: 'var(--ps-surf-3)' }}
        >
          <span className="mt-0.5 shrink-0 text-gold">
            <Icon icon={IconAviso} size={16} />
          </span>
          <span>
            Estos campos afectan a las partidas <strong className="font-semibold">en curso</strong>. Psique
            lee el perfil del personaje en cada turno, así que quien esté leyendo la historia notará el
            cambio en su siguiente mensaje. El saludo ya enviado y lo ya jugado no cambian.
          </span>
        </p>
      }
    />
  )
}
