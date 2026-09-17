import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createCustomStory,
  customStoryQueryKeys,
  fieldErrorsFrom,
  generalErrorFrom,
  type CreateCustomStory,
} from '@/api/customStories'
import { StoryField } from '@/features/customStories/StoryField'
import {
  AGE_MAX,
  AGE_MIN,
  CONCEPTO_LIMITS,
  DEFINIDA_LIMITS,
  validateConcepto,
  validateDefinida,
  type ConceptoField,
  type DefinidaField,
  type FieldErrors,
} from '@/features/customStories/limits'
import { routes } from '@/router/paths'
import type { CustomStoryMode } from '@/shared/lib/events'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/Switch'

const EMPTY_DEFINIDA: Record<DefinidaField, string> = {
  title: '',
  name: '',
  age: '',
  personality: '',
  speakingStyle: '',
  setting: '',
  tone: '',
  // Mismo orden que en pantalla: el primer error enfocado es el primero que se ve.
  hook: '',
  backstory: '',
}

const EMPTY_CONCEPTO: Record<ConceptoField, string> = { premise: '', tone: '' }

const MODES: { id: CustomStoryMode; label: string; help: string }[] = [
  { id: 'definida', label: 'Definida', help: 'Tú describes al personaje y su mundo.' },
  { id: 'concepto', label: 'Concepto', help: 'Das una idea y Psique inventa el resto, que irás descubriendo.' },
]

function range(limit: { min: number; max: number; optional?: boolean }) {
  return `${limit.optional ? 'Opcional. ' : ''}Entre ${limit.min} y ${limit.max} caracteres.`
}

function focusFirstError(errors: FieldErrors, order: readonly string[]) {
  const first = order.find((field) => errors[field])
  if (first) document.getElementById(first)?.focus()
}

export function CreateStoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<CustomStoryMode>('definida')
  const [definida, setDefinida] = useState(EMPTY_DEFINIDA)
  const [concepto, setConcepto] = useState(EMPTY_CONCEPTO)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [freeFirstRead, setFreeFirstRead] = useState(true)

  const create = useMutation({
    mutationFn: createCustomStory,
    onSuccess: async () => {
      await Promise.all(customStoryQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      navigate(routes.characters)
    },
    onError: (error) => {
      const fieldErrors = fieldErrorsFrom(error)
      setErrors(fieldErrors)
      setGeneralError(generalErrorFrom(error))
      focusFirstError(fieldErrors, Object.keys(mode === 'definida' ? EMPTY_DEFINIDA : EMPTY_CONCEPTO))
    },
  })

  const pending = create.isPending

  function changeMode(next: CustomStoryMode) {
    setMode(next)
    setErrors({})
    setGeneralError(null)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const localErrors = mode === 'definida' ? validateDefinida(definida) : validateConcepto(concepto)
    setErrors(localErrors)
    setGeneralError(null)
    if (Object.keys(localErrors).length) {
      focusFirstError(localErrors, Object.keys(mode === 'definida' ? EMPTY_DEFINIDA : EMPTY_CONCEPTO))
      return
    }

    let body: CreateCustomStory
    if (mode === 'definida') {
      const d = definida
      body = {
        mode,
        title: d.title.trim(),
        name: d.name.trim(),
        age: Number(d.age),
        personality: d.personality.trim(),
        speakingStyle: d.speakingStyle.trim(),
        setting: d.setting.trim(),
        tone: d.tone.trim(),
        backstory: d.backstory.trim(),
        hook: d.hook.trim() || null,
        isPublic,
        freeFirstRead,
      }
    } else {
      body = { mode, premise: concepto.premise.trim(), tone: concepto.tone.trim() || null, isPublic, freeFirstRead }
    }
    create.mutate(body)
  }

  function bindDefinida(field: Exclude<DefinidaField, 'age'>) {
    const limit = DEFINIDA_LIMITS[field]
    return {
      id: field,
      value: definida[field],
      onChange: (value: string) => setDefinida((prev) => ({ ...prev, [field]: value })),
      error: errors[field],
      maxLength: limit.max,
      hint: range(limit),
      required: !('optional' in limit && limit.optional),
    }
  }

  function bindConcepto(field: ConceptoField) {
    const limit = CONCEPTO_LIMITS[field]
    return {
      id: field,
      value: concepto[field],
      onChange: (value: string) => setConcepto((prev) => ({ ...prev, [field]: value })),
      error: errors[field],
      maxLength: limit.max,
      hint: range(limit),
      required: !('optional' in limit && limit.optional),
    }
  }

  const pendingLabel = mode === 'concepto' ? 'Imaginando tu historia…' : 'Creando tu historia…'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          to={routes.characters}
          className="inline-flex items-center gap-1 text-body-sm font-semibold text-accent-text underline"
        >
          <ArrowLeft size={16} aria-hidden />
          Volver a las historias
        </Link>
        <h1 className="mt-3 font-serif text-display text-ink">Crea tu historia</h1>
        <p className="mt-2 text-body-sm text-ink-dim">
          Romance para todos los públicos, siempre entre personas adultas.
        </p>
      </header>

      {/* overflow visible en escritorio para que el selector de modo pueda quedarse fijo al hacer scroll. */}
      <Card className="p-5 lg:overflow-visible lg:p-8">
        <form
          onSubmit={onSubmit}
          noValidate
          aria-busy={pending}
          className="lg:grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start lg:gap-10"
        >
          <fieldset className="mb-6 lg:sticky lg:top-6 lg:mb-0" disabled={pending}>
            <legend className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
              Tipo de historia
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {MODES.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 has-focus-visible:ring-2 has-focus-visible:ring-[color:var(--ps-accent-text)]',
                    mode === m.id ? 'bg-surf-3' : 'hover:bg-surf-2',
                  )}
                  style={{ borderColor: mode === m.id ? 'var(--ps-accent-text)' : 'var(--ps-line-strong)' }}
                >
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <input
                      type="radio"
                      name="mode"
                      value={m.id}
                      checked={mode === m.id}
                      onChange={() => changeMode(m.id)}
                      className="accent-[color:var(--ps-primary)]"
                      aria-describedby={`mode-${m.id}-help`}
                    />
                    {m.label}
                  </span>
                  <span id={`mode-${m.id}-help`} className="text-body-sm text-ink-dim">
                    {m.help}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="min-w-0">
            <fieldset disabled={pending} className="md:grid md:grid-cols-2 md:gap-x-4">
              <legend className="sr-only">{mode === 'definida' ? 'Datos de la historia' : 'Idea de la historia'}</legend>
              {/* Los campos cortos van en pareja desde tablet; los de texto largo ocupan toda la fila. */}
              {mode === 'definida' ? (
                <>
                  <StoryField label="Título" className="md:col-span-2" {...bindDefinida('title')} />
                  <StoryField label="Nombre del personaje" {...bindDefinida('name')} />
                  <StoryField
                    id="age"
                    label="Edad"
                    type="number"
                    min={AGE_MIN}
                    max={AGE_MAX}
                    value={definida.age}
                    onChange={(value) => setDefinida((prev) => ({ ...prev, age: value }))}
                    error={errors.age}
                    hint={`Entre ${AGE_MIN} y ${AGE_MAX} años.`}
                    required
                  />
                  <StoryField
                    label="Personalidad"
                    placeholder="tímida, ingeniosa; leal"
                    multiline
                    rows={2}
                    {...bindDefinida('personality')}
                    hint="Rasgos separados por comas. Entre 3 y 300 caracteres."
                  />
                  <StoryField label="Forma de hablar" multiline rows={2} {...bindDefinida('speakingStyle')} />
                  <StoryField
                    label="Escenario inicial"
                    multiline
                    className="md:col-span-2"
                    {...bindDefinida('setting')}
                    hint="Es la primera escena de la historia. Entre 20 y 590 caracteres."
                  />
                  <StoryField label="Tono" placeholder="melancólico y cálido" {...bindDefinida('tone')} />
                  <StoryField
                    label="Gancho"
                    {...bindDefinida('hook')}
                    hint="Opcional. Si lo dejas vacío, se usa la primera frase del escenario. Entre 10 y 140 caracteres."
                  />
                  <StoryField
                    label="Pasado del personaje"
                    multiline
                    rows={4}
                    className="md:col-span-2"
                    {...bindDefinida('backstory')}
                  />
                </>
              ) : (
                <>
                  <StoryField
                    label="Premisa"
                    multiline
                    rows={4}
                    placeholder="Un farero solitario recibe cartas de alguien que no existe"
                    className="md:col-span-2"
                    {...bindConcepto('premise')}
                  />
                  <StoryField label="Tono" placeholder="misterioso" {...bindConcepto('tone')} />
                </>
              )}
            </fieldset>

            <div
              className="mb-4 flex items-center justify-between gap-4 rounded-[14px] border p-3"
              style={{ borderColor: 'var(--ps-line-strong)' }}
            >
              <div className="min-w-0">
                <p id="publicar-label" className="font-semibold text-ink">
                  Publicar en Explorar
                </p>
                <p id="publicar-help" className="text-body-sm text-ink-dim">
                  {mode === 'concepto'
                    ? 'Los demás verán el título, el gancho y el tono; el resto lo descubren jugando.'
                    : 'Otras personas podrán leerla. Puedes hacerla privada cuando quieras.'}
                </p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={pending}
                aria-labelledby="publicar-label"
                aria-describedby="publicar-help"
              />
            </div>

            <div
              className="mb-4 flex items-center justify-between gap-4 rounded-[14px] border p-3"
              style={{ borderColor: 'var(--ps-line-strong)' }}
            >
              <div className="min-w-0">
                <p id="gratis-label" className="font-semibold text-ink">
                  Primera lectura gratis
                </p>
                <p id="gratis-help" className="text-body-sm text-ink-dim">
                  {freeFirstRead
                    ? 'Cada lector empieza gratis; releer cuesta óbolos.'
                    : 'Leerla cuesta óbolos desde la primera vez.'}{' '}
                  Puedes cambiarlo después.
                </p>
              </div>
              <Switch
                checked={freeFirstRead}
                onCheckedChange={setFreeFirstRead}
                disabled={pending}
                aria-labelledby="gratis-label"
                aria-describedby="gratis-help"
              />
            </div>

            {generalError ? (
              <p role="alert" className="mb-3 text-[13px] text-error">
                {generalError}
              </p>
            ) : null}

            <p aria-live="polite" className="mb-3 text-body-sm text-ink-dim empty:hidden">
              {pending ? pendingLabel : ''}
            </p>

            <Button type="submit" variant="brand" className="w-full md:ml-auto md:flex md:w-auto md:min-w-64" disabled={pending}>
              <Sparkles size={16} aria-hidden />
              {pending ? pendingLabel : 'Crear historia'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
