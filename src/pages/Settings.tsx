import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchMyProfile,
  myProfileQueryKey,
  profileFieldErrors,
  profileGeneralError,
  updateMyProfile,
  type MyProfile,
  type ProfileUpdate,
} from '@/api/profile'
import { activeRestriction, formatRestrictedUntil, revokeAdult } from '@/api/policy'
import { AccountDataSettings } from '@/features/account/AccountDataSettings'
import { RestrictionIncidents } from '@/features/incidents/RestrictionIncidents'
import { StoryField } from '@/features/customStories/StoryField'
import { AdultConfirmDialog } from '@/features/policy/AdultConfirmDialog'
import { ProfileImageField } from '@/features/profile/ProfileImageField'
import {
  PROFILE_FIELD_ORDER,
  PROFILE_LIMITS,
  normalizeDisplayName,
  normalizeHandle,
  validateProfile,
  type ProfileFormField,
  type ProfileFormValues,
} from '@/features/profile/limits'
import { routes } from '@/router/paths'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/Switch'
import { useAuthStore } from '@/stores/authStore'

type FieldErrors = Partial<Record<string, string>>

const SECTIONS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'contenido', label: 'Contenido +18' },
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'datos', label: 'Tus datos' },
] as const

function valuesFrom(profile: MyProfile): ProfileFormValues {
  return {
    displayName: profile.displayName,
    handle: profile.handle,
    bio: profile.bio ?? '',
    link: profile.link ?? '',
  }
}

/** Solo viaja lo que cambió: el PATCH es parcial y así un campo intacto no puede fallar. */
function changesFrom(values: ProfileFormValues, profile: MyProfile): ProfileUpdate {
  const changes: ProfileUpdate = {}
  const displayName = normalizeDisplayName(values.displayName)
  const handle = normalizeHandle(values.handle)
  const bio = values.bio.trim()
  const link = values.link.trim()
  if (displayName !== profile.displayName) changes.displayName = displayName
  if (handle !== profile.handle) changes.handle = handle
  if (bio !== (profile.bio ?? '')) changes.bio = bio || null
  if (link !== (profile.link ?? '')) changes.link = link || null
  return changes
}

function focusFirstError(errors: FieldErrors) {
  const first = PROFILE_FIELD_ORDER.find((field) => errors[field])
  if (first) document.getElementById(first)?.focus()
}

function SettingsSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-6">
      <Card className="p-5 lg:p-8">
        <h2 id={`${id}-titulo`} className="font-serif text-headline-lg text-ink">
          {title}
        </h2>
        <p className="mt-1 mb-6 text-body-sm text-ink-dim">{description}</p>
        {children}
      </Card>
    </section>
  )
}

type Announce = (message: string) => void

function ProfileForm({ profile, onSaved, announce }: { profile: MyProfile; onSaved: (p: MyProfile) => void; announce: Announce }) {
  const [values, setValues] = useState(() => valuesFrom(profile))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  // Mientras se guarda el fieldset está deshabilitado y no admite foco: se enfoca al terminar.
  const pendingFocus = useRef<FieldErrors | null>(null)

  const save = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (next) => {
      setValues(valuesFrom(next))
      onSaved(next)
      announce('Cambios guardados.')
    },
    onError: (error) => {
      const fieldErrors = profileFieldErrors(error)
      const known = Object.fromEntries(
        Object.entries(fieldErrors).filter(([field]) => (PROFILE_FIELD_ORDER as string[]).includes(field)),
      )
      setErrors(known)
      setGeneralError(
        Object.keys(known).length ? 'Revisa los campos marcados.' : profileGeneralError(error, 'No se pudieron guardar los cambios.'),
      )
      pendingFocus.current = known
    },
  })

  useEffect(() => {
    if (!save.isPending && pendingFocus.current) {
      focusFirstError(pendingFocus.current)
      pendingFocus.current = null
    }
  }, [save.isPending])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setGeneralError(null)
    const localErrors = validateProfile(values)
    setErrors(localErrors)
    if (Object.keys(localErrors).length) {
      focusFirstError(localErrors)
      return
    }
    const changes = changesFrom(values, profile)
    if (!Object.keys(changes).length) {
      announce('No hay cambios que guardar.')
      return
    }
    save.mutate(changes)
  }

  function bind(field: ProfileFormField) {
    return {
      id: field,
      value: values[field],
      onChange: (value: string) => setValues((prev) => ({ ...prev, [field]: value })),
      error: errors[field],
    }
  }

  const bioLength = values.bio.trim().length

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={save.isPending}>
      <fieldset disabled={save.isPending} className="md:grid md:grid-cols-2 md:gap-x-4">
        <legend className="sr-only">Datos públicos del perfil</legend>
        <StoryField
          label="Nombre visible"
          maxLength={PROFILE_LIMITS.displayName}
          autoComplete="nickname"
          hint="Es el nombre que ven los demás. Hasta 64 caracteres."
          required
          {...bind('displayName')}
        />
        <StoryField
          label="Handle"
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
          hint={`Tu perfil estará en /u/${normalizeHandle(values.handle) || 'tu_handle'}. De 3 a 30: minúsculas, números o _.`}
          required
          {...bind('handle')}
        />
        <StoryField
          label="Bio"
          multiline
          rows={3}
          maxLength={PROFILE_LIMITS.bio}
          enforceMaxLength={false}
          className="md:col-span-2"
          hint={`Opcional. Llevas ${bioLength} de ${PROFILE_LIMITS.bio} caracteres.`}
          {...bind('bio')}
        />
        <StoryField
          label="Enlace"
          type="url"
          autoComplete="url"
          placeholder="https://"
          className="md:col-span-2"
          hint="Opcional. Una web tuya, empezando por http:// o https://."
          {...bind('link')}
        />
      </fieldset>

      {generalError ? (
        <p role="alert" className="mb-3 text-[13px] text-error">
          {generalError}
        </p>
      ) : null}

      <Button type="submit" variant="brand" className="w-full md:ml-auto md:flex md:w-auto md:min-w-56" disabled={save.isPending}>
        {save.isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}

type PrivacyKey = 'showPublished' | 'showReading'

const PRIVACY: { key: PrivacyKey; label: string; help: string }[] = [
  { key: 'showPublished', label: 'Mostrar mis historias publicadas', help: 'La estantería "Publicadas" de tu perfil.' },
  { key: 'showReading', label: 'Mostrar lo que estoy leyendo', help: 'La estantería "Leyendo", con tus partidas y su fase.' },
]

function PrivacySettings({ profile, onSaved, announce }: { profile: MyProfile; onSaved: (p: MyProfile) => void; announce: Announce }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const toggle = useMutation({
    mutationFn: (change: Partial<Record<PrivacyKey, boolean>>) => updateMyProfile(change),
    // Optimista: el interruptor cambia al momento y vuelve atrás si el servidor falla.
    onMutate: (change) => {
      const previous = queryClient.getQueryData<MyProfile>(myProfileQueryKey)
      if (previous) queryClient.setQueryData(myProfileQueryKey, { ...previous, ...change })
      setError(null)
      return { previous }
    },
    onSuccess: (next, change) => {
      onSaved(next)
      const [key, value] = Object.entries(change)[0] as [PrivacyKey, boolean]
      const shelf = key === 'showPublished' ? 'Publicadas' : 'Leyendo'
      announce(value ? `La estantería ${shelf} ya es visible para los demás.` : `La estantería ${shelf} queda oculta para los demás.`)
    },
    onError: (err, _change, context) => {
      if (context?.previous) queryClient.setQueryData(myProfileQueryKey, context.previous)
      setError(profileGeneralError(err, 'No se pudo cambiar la privacidad. Inténtalo de nuevo.'))
    },
  })

  return (
    <div className="space-y-2">
      <ul className="divide-y" style={{ borderColor: 'var(--ps-line)' }}>
        {PRIVACY.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4 py-3" style={{ borderColor: 'var(--ps-line)' }}>
            <div className="min-w-0">
              <p id={`${item.key}-label`} className="font-semibold text-ink">
                {item.label}
              </p>
              <p id={`${item.key}-help`} className="text-body-sm text-ink-dim">
                {item.help}
              </p>
            </div>
            <Switch
              checked={profile[item.key]}
              aria-labelledby={`${item.key}-label`}
              aria-describedby={`${item.key}-help`}
              onCheckedChange={(checked) => toggle.mutate({ [item.key]: checked })}
            />
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-[13px] text-error">
          {error}
        </p>
      ) : null}
      <p className="text-body-sm text-ink-dim">
        Tú siempre ves tus estanterías completas en{' '}
        <Link to={routes.profile(profile.handle)} className="font-semibold text-accent-text underline">
          tu perfil
        </Link>
        .
      </p>
    </div>
  )
}

function AdultSettings({ announce }: { announce: Announce }) {
  const queryClient = useQueryClient()
  const confirmed = useAuthStore((s) => s.user?.adultConfirmed ?? false)
  const [asking, setAsking] = useState(false)

  const revoke = useMutation({
    mutationFn: revokeAdult,
    onSuccess: () => {
      for (const queryKey of [['book'], ['explore'], ['characters'], ['profile']]) {
        void queryClient.invalidateQueries({ queryKey })
      }
      announce('Has retirado la confirmación. Los libros +18 dejan de mostrarse.')
    },
  })

  return (
    <div className="space-y-3">
      <p id="contenido-estado" className="text-body-sm text-ink">
        <span className="font-semibold">Estado: </span>
        {confirmed ? 'has confirmado que eres mayor de edad.' : 'no has confirmado que eres mayor de edad.'}
      </p>
      <p className="text-body-sm text-ink-dim">
        {confirmed
          ? 'Ves y puedes leer las historias +18. Si retiras la confirmación, dejarán de aparecer en Explorar y se te volverá a preguntar antes de leerlas.'
          : 'Las historias +18 no aparecen en Explorar y se te preguntará antes de leer una. En todas, las escenas íntimas se cierran con un fundido a negro.'}
      </p>
      {revoke.isError ? (
        <p role="alert" className="text-[13px] text-error">
          {profileGeneralError(revoke.error, 'No se pudo retirar la confirmación. Inténtalo de nuevo.')}
        </p>
      ) : null}
      {confirmed ? (
        <Button variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate()} aria-describedby="contenido-estado">
          {revoke.isPending ? 'Retirando…' : 'Retirar confirmación'}
        </Button>
      ) : (
        <Button variant="brand" onClick={() => setAsking(true)} aria-describedby="contenido-estado">
          Confirmar que soy mayor de edad
        </Button>
      )}
      <AdultConfirmDialog
        open={asking}
        onCancel={() => setAsking(false)}
        onConfirmed={() => {
          setAsking(false)
          announce('Confirmado: eres mayor de edad y ya puedes ver las historias +18.')
        }}
      />
    </div>
  )
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const profile = useQuery({ queryKey: myProfileQueryKey, queryFn: fetchMyProfile })
  const restrictedUntil = activeRestriction(user?.restrictedUntil)
  const [status, setStatus] = useState('')

  function announce(message: string) {
    // Vaciar antes permite repetir el mismo mensaje y que el lector lo vuelva a leer.
    setStatus('')
    window.setTimeout(() => setStatus(message), 50)
  }

  function onSaved(next: MyProfile) {
    queryClient.setQueryData(myProfileQueryKey, next)
    patchUser({ displayName: next.displayName, handle: next.handle })
    void queryClient.invalidateQueries({ queryKey: ['profile'] })
    void queryClient.invalidateQueries({ queryKey: ['explore'] })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-serif text-display text-ink">Configuración</h1>
        <p className="mt-2 text-body-sm text-ink-dim">Cómo te ven los demás y qué compartes en tu perfil.</p>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <nav aria-label="Secciones de configuración" className="mb-6 lg:sticky lg:top-6 lg:mb-0">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
            {SECTIONS.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-touch w-full items-center rounded-xl border border-outline-variant px-4 text-body-sm font-semibold text-ink-dim hover:bg-surf-2 hover:text-ink lg:border-transparent"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <p role="status" aria-live="polite" className="sr-only">
            {status}
          </p>

          {profile.isPending ? <p className="text-ink-dim">Cargando tu perfil…</p> : null}
          {profile.isError ? (
            <Card className="space-y-3 p-5">
              <p role="alert" className="text-body-sm text-error">
                No se pudo cargar tu perfil.
              </p>
              <Button variant="outline" onClick={() => void profile.refetch()}>
                Reintentar
              </Button>
            </Card>
          ) : null}

          {profile.data ? (
            <>
              <SettingsSection id="perfil" title="Perfil" description="Lo que aparece en tu página pública y junto a tus historias.">
                <div className="mb-8 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
                  <ProfileImageField kind="avatar" profile={profile.data} onChanged={onSaved} onAnnounce={announce} />
                  <ProfileImageField kind="banner" profile={profile.data} onChanged={onSaved} onAnnounce={announce} />
                </div>
                <ProfileForm profile={profile.data} onSaved={onSaved} announce={announce} />
              </SettingsSection>

              <SettingsSection id="privacidad" title="Privacidad" description="Decide qué estanterías de tu perfil pueden ver otras personas.">
                <PrivacySettings profile={profile.data} onSaved={onSaved} announce={announce} />
              </SettingsSection>
            </>
          ) : null}

          <SettingsSection
            id="contenido"
            title="Contenido +18"
            description="Confirma tu mayoría de edad para ver y leer historias marcadas como +18."
          >
            <AdultSettings announce={announce} />
          </SettingsSection>

          <SettingsSection id="cuenta" title="Cuenta" description="Datos para entrar en Psique.">
            <dl className="grid gap-1 text-body-sm">
              <dt className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">Usuario para entrar</dt>
              <dd className="text-ink">{user?.username ?? '—'}</dd>
            </dl>
            <p className="mt-3 text-body-sm text-ink-dim">
              El usuario no cambia al cambiar el handle. Pronto podrás cambiar la contraseña desde aquí.
            </p>
            {restrictedUntil ? (
              <p className="mt-3 text-body-sm text-ink">
                <span className="font-semibold">Restricción temporal:</span> hasta el {formatRestrictedUntil(restrictedUntil)}{' '}
                no puedes empezar ni continuar historias por incumplir las normas.
              </p>
            ) : null}
            {restrictedUntil ? <RestrictionIncidents /> : null}
          </SettingsSection>

          <SettingsSection id="datos" title="Tus datos" description="Llévate una copia de todo lo que guardamos o borra la cuenta.">
            <AccountDataSettings announce={announce} />
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
