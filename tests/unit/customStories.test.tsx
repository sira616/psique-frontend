import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { fieldErrorsFrom } from '@/api/customStories'
import { CONTENT_MESSAGES, DEMO_USER, mockCharacters } from '@/mocks/fixtures'
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
    expect(within(ownSection()).getByText('Irene Solís')).toBeInTheDocument()
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
    expect(card.closest('li')).toHaveTextContent('Por descubrir')
  })
})

describe('Mis historias', () => {
  it('separa las secciones y el concepto no enseña campos vacíos', async () => {
    renderApp(routes.characters)

    const psique = await screen.findByRole('region', { name: 'Historias de Psique' })
    expect(within(psique).getByRole('heading', { name: 'Lucía Ferrer' })).toBeInTheDocument()
    const concept = (await within(ownSection()).findByRole('heading', { name: 'La carta del faro' })).closest('li')!
    expect(concept).toHaveTextContent('Por descubrir')
    expect(concept).not.toHaveTextContent(/null|undefined|años/)
    expect(screen.getByRole('link', { name: 'Crear historia' })).toHaveAttribute('href', routes.nuevaHistoria)
  })

  it('muestra un estado vacío amable si no hay propias', async () => {
    server.use(http.get('/api/characters', () => HttpResponse.json(mockCharacters)))
    renderApp(routes.characters)

    expect(await within(await screen.findByRole('region', { name: 'Mis historias' })).findByText(/Todavía no has creado/))
      .toBeInTheDocument()
  })

  it('pide confirmación, gestiona el foco y borra', async () => {
    const user = userEvent.setup()
    renderApp(routes.characters)

    const trigger = await screen.findByRole('button', { name: 'Borrar La carta del faro' })
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Borrar La carta del faro' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Borrar La carta del faro' }))
    expect(screen.getByRole('group', { name: /¿Borrar «La carta del faro»\?/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'La carta del faro' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Mis historias' })).toHaveFocus()
    expect(within(ownSection()).getByRole('heading', { name: 'Café a medianoche' })).toBeInTheDocument()
  })

  it('cambia una historia a pública al momento y lo confirma', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.patch('/api/custom-stories/:id', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderApp(routes.characters)

    const toggle = await screen.findByRole('switch', { name: 'Pública: La carta del faro' })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Pública: Café a medianoche' })).toHaveAttribute('aria-checked', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(await within(toggle.closest('li')!).findByText('Ahora es pública y aparece en Explorar.')).toBeInTheDocument()
    expect(body).toEqual({ isPublic: true })
  })

  it('si el servidor falla, el interruptor vuelve atrás y avisa', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/custom-stories/:id', () =>
        HttpResponse.json({ detail: 'Historia propia no encontrada.' }, { status: 404 }),
      ),
    )
    renderApp(routes.characters)

    const toggle = await screen.findByRole('switch', { name: 'Pública: La carta del faro' })
    await waitFor(() => expect(toggle).toBeEnabled())
    await user.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent('Historia propia no encontrada.')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('cambia "Primera lectura gratis" con un PATCH solo de ese campo', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.patch('/api/custom-stories/:id', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderApp(routes.characters)

    const toggle = await screen.findByRole('switch', { name: 'Primera lectura gratis: La carta del faro' })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(await within(toggle.closest('li')!).findByText(/cuesta óbolos desde la primera vez/)).toBeInTheDocument()
    expect(body).toEqual({ freeFirstRead: false })
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

    const own = await screen.findByRole('link', { name: 'Ver libro: La carta del faro' })
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
