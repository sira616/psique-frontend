import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { fieldErrorsFrom } from '@/api/customStories'
import { CONTENT_MESSAGES, DEMO_USER } from '@/mocks/fixtures'
import { __resetCustomStories } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { CharactersPage } from '@/pages/Characters'
import { CreateStoryPage } from '@/pages/CreateStory'
import { routes } from '@/router/paths'
import { ApiError, apiClient } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: never }>('/api/auth/login', {
    method: 'POST',
    body: { login: DEMO_USER.username, password: DEMO_USER.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

function StoryStub() {
  const { storyId } = useParams()
  return <p>Historia {storyId}</p>
}

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routes.characters} element={<CharactersPage />} />
          <Route path={routes.nuevaHistoria} element={<CreateStoryPage />} />
          <Route path="/historia/:storyId" element={<StoryStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const DEFINIDA_OK = {
  Título: 'Faro de invierno',
  'Nombre del personaje': 'Irene Solís',
  Edad: '41',
  Personalidad: 'serena, observadora',
  'Forma de hablar': 'Habla despacio y elige cada palabra.',
  'Escenario inicial': 'Un faro en la costa gallega durante un temporal de enero.',
  Tono: 'sereno',
  'Pasado del personaje': 'Fue bióloga marina y volvió al pueblo para cuidar el faro que era de su abuelo.',
}

async function fillDefinida(user: ReturnType<typeof userEvent.setup>, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    const control = screen.getByLabelText(label)
    await user.clear(control)
    // paste en vez de type: teclear carácter a carácter hace el test muy lento.
    await user.click(control)
    await user.paste(value)
  }
}

function ownSection() {
  return screen.getByRole('region', { name: 'Mis historias' })
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('crear historia definida', () => {
  it('marca la edad de menores como error del campo y no envía', async () => {
    const user = userEvent.setup()
    let posted = false
    server.use(
      http.post('/api/custom-stories', () => {
        posted = true
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderApp(routes.nuevaHistoria)

    await fillDefinida(user, { ...DEFINIDA_OK, Edad: '17' })
    await user.click(screen.getByRole('button', { name: 'Crear historia' }))

    const age = screen.getByLabelText('Edad')
    expect(age).toHaveAttribute('aria-invalid', 'true')
    expect(age).toHaveAccessibleDescription(/tienen que ser adultos/)
    expect(age).toHaveFocus()
    expect(posted).toBe(false)
  })

  it('envía, vuelve a la lista y aparece en "Mis historias"', async () => {
    const user = userEvent.setup()
    renderApp(routes.nuevaHistoria)

    expect(screen.getByLabelText('Título')).toHaveAttribute('maxLength', '80')
    await fillDefinida(user, DEFINIDA_OK)
    await user.click(screen.getByRole('button', { name: 'Crear historia' }))

    expect(await screen.findByRole('heading', { name: 'Mis historias' })).toBeInTheDocument()
    expect(await within(ownSection()).findByRole('heading', { name: 'Faro de invierno' })).toBeInTheDocument()
    // La tarjeta de la portada lleva al detalle, que es donde se edita.
    expect(within(ownSection()).getByRole('link', { name: 'Faro de invierno' })).toHaveAttribute(
      'href',
      expect.stringContaining('/mis-historias/'),
    )
  })

  it('muestra en role="alert" el 422 de contenido del backend', async () => {
    const user = userEvent.setup()
    renderApp(routes.nuevaHistoria)

    await fillDefinida(user, {
      ...DEFINIDA_OK,
      'Pasado del personaje': 'Su historia gira alrededor del sexo y de nada más, durante años y años.',
    })
    await user.click(screen.getByRole('button', { name: 'Crear historia' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(CONTENT_MESSAGES.sexual)
    expect(screen.getByRole('heading', { name: 'Crea tu historia' })).toBeInTheDocument()
  })
})

describe('crear historia concepto', () => {
  it('avisa mientras se imagina y la añade al terminar', async () => {
    const user = userEvent.setup()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('/api/custom-stories', async ({ request }) => {
        const body = (await request.clone().json()) as { mode: string; premise: string; tone: string | null }
        expect(body).toEqual({
          mode: 'concepto',
          premise: 'Dos relojeros rivales comparten taller por error',
          tone: null,
          isPublic: false,
          freeFirstRead: true,
          adult: false,
        })
        await gate
        // Sin respuesta: sigue al handler normal del mock.
        return undefined
      }),
    )
    renderApp(routes.nuevaHistoria)

    await user.click(screen.getByRole('radio', { name: /Concepto/ }))
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Premisa'))
    await user.paste('Dos relojeros rivales comparten taller por error')
    await user.click(screen.getByRole('button', { name: 'Crear historia' }))

    const busy = await screen.findByRole('button', { name: 'Imaginando tu historia…' })
    expect(busy).toBeDisabled()
    release()

    const card = await within(await screen.findByRole('region', { name: 'Mis historias' })).findByRole(
      'heading',
      { name: 'Dos relojeros rivales comparten taller por error' },
    )
    expect(card.closest('li')).toHaveTextContent('Concepto')
  })
})

describe('Mis historias en la portada', () => {
  it('separa las secciones y el concepto no enseña campos vacíos', async () => {
    renderApp(routes.characters)

    const psique = await screen.findByRole('region', { name: 'Historias de Psique' })
    expect(within(psique).getByRole('heading', { name: 'Lucía Ferrer' })).toBeInTheDocument()
    const concept = (await within(ownSection()).findByRole('heading', { name: 'La carta del faro' })).closest('li')!
    expect(concept).toHaveTextContent('Concepto')
    expect(concept).not.toHaveTextContent(/null|undefined|años/)
    expect(screen.getByRole('link', { name: 'Crear historia' })).toHaveAttribute('href', routes.nuevaHistoria)
  })

  /**
   * La portada solo enseña las más recientes y lleva a la sección: publicar, editar y borrar se
   * hacen en /mis-historias y en el detalle, para no tener dos interfaces para lo mismo.
   */
  it('es una tira de solo lectura con enlace a la sección', async () => {
    renderApp(routes.characters)

    const verTodas = await within(ownSection()).findByRole('link', { name: 'Ver todas (2)' })
    expect(verTodas).toHaveAttribute('href', routes.misHistorias)
    expect(within(ownSection()).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(ownSection()).queryByRole('button')).not.toBeInTheDocument()
    expect(within(ownSection()).getByRole('link', { name: 'La carta del faro' })).toHaveAttribute(
      'href',
      routes.misHistoriaDetalle('1084427a03094ac590adbb943a02f801'),
    )
  })

  it('muestra un estado vacío amable si no hay propias', async () => {
    server.use(http.get('/api/custom-stories', () => HttpResponse.json([])))
    renderApp(routes.characters)

    expect(await within(ownSection()).findByText(/Todavía no has creado/)).toBeInTheDocument()
    expect(within(ownSection()).queryByRole('link', { name: /Ver todas/ })).not.toBeInTheDocument()
  })

  it('las tarjetas enlazan al libro y no empiezan partidas', async () => {
    let started = false
    server.use(
      http.post('/api/stories', () => {
        started = true
        return undefined
      }),
    )
    renderApp(routes.characters)

    const own = await screen.findByRole('link', { name: 'Ver La carta del faro como lector' })
    expect(own).toHaveAttribute('href', '/libro/custom%3A1084427a03094ac590adbb943a02f801')
    expect(screen.getByRole('link', { name: 'Ver libro: Lucía Ferrer' })).toHaveAttribute('href', '/libro/lucia')
    expect(screen.queryByRole('button', { name: /Empezar historia|Descubrir historia/ })).not.toBeInTheDocument()
    expect(started).toBe(false)
  })

  it('el formulario de crear manda freeFirstRead: false si se apaga', async () => {
    const user = userEvent.setup()
    let body: Record<string, unknown> | undefined
    server.use(
      http.post('/api/custom-stories', async ({ request }) => {
        body = (await request.clone().json()) as Record<string, unknown>
        return undefined
      }),
    )
    renderApp(routes.nuevaHistoria)

    await user.click(screen.getByRole('radio', { name: /Concepto/ }))
    await user.click(screen.getByLabelText('Premisa'))
    await user.paste('Una cartera perdida en el metro de Madrid')
    const toggle = screen.getByRole('switch', { name: 'Primera lectura gratis' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Crear historia' }))

    await waitFor(() => expect(body?.freeFirstRead).toBe(false))
  })
})

describe('fieldErrorsFrom', () => {
  it('lleva los 422 de esquema a su campo y quita el prefijo de pydantic', () => {
    const error = new ApiError(422, 'Algo ha fallado', {
      detail: [
        { loc: ['body', 'definida', 'age'], msg: 'Value error, Los personajes tienen que ser adultos (entre 18 y 90 años)' },
        { loc: ['body', 'concepto', 'premise'], msg: 'String should have at least 20 characters' },
        { loc: ['body'], msg: 'Modo no válido' },
      ],
    })
    expect(fieldErrorsFrom(error)).toEqual({
      age: 'Los personajes tienen que ser adultos (entre 18 y 90 años)',
      premise: 'String should have at least 20 characters',
    })
    expect(fieldErrorsFrom(new ApiError(422, CONTENT_MESSAGES.minors, { detail: CONTENT_MESSAGES.minors }))).toEqual({})
  })
})
