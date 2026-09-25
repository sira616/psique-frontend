import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_USER, seedCustomStories } from '@/mocks/fixtures'
import { __resetCustomStories } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { MyStoriesPage } from '@/pages/MyStories'
import { routes } from '@/router/paths'
import { apiClient } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

const [CONCEPTO, DEFINIDA] = seedCustomStories()

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: never }>('/api/auth/login', {
    method: 'POST',
    body: { login: DEMO_USER.username, password: DEMO_USER.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

/** Stub del detalle: aquí solo interesa que la sección lleve a su ruta. */
function DetalleStub() {
  const { storyId } = useParams()
  return <p>Detalle {storyId}</p>
}

function renderSeccion() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[routes.misHistorias]}>
        <Routes>
          <Route path={routes.misHistorias} element={<MyStoriesPage />} />
          <Route path="/mis-historias/:storyId" element={<DetalleStub />} />
          <Route path={routes.nuevaHistoria} element={<p>Crear</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function tarjetas() {
  return within(screen.getByRole('region', { name: 'Historias propias' })).getAllByRole('listitem')
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('/mis-historias: rejilla y estados', () => {
  it('pinta una tarjeta por historia con su estado y su enlace al detalle', async () => {
    renderSeccion()

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis historias' })).toBeInTheDocument()

    const concepto = await screen.findByRole('link', { name: CONCEPTO.title })
    expect(tarjetas()).toHaveLength(2)
    expect(concepto).toHaveAttribute('href', routes.misHistoriaDetalle(CONCEPTO.id))
    const fila = concepto.closest('li')!
    expect(within(fila).getByText('Privada')).toBeInTheDocument()
    expect(within(fila).getByText('Concepto')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: DEFINIDA.title }).closest('li')!).getByText('Pública'))
      .toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Crear historia' })).toHaveAttribute('href', routes.nuevaHistoria)
  })

  it('anuncia cuántas hay en pantalla', async () => {
    renderSeccion()
    expect(await screen.findByRole('status')).toHaveTextContent('2 historias en pantalla.')
  })

  it('el estado vacío de no tener ninguna no habla de filtros', async () => {
    server.use(http.get('/api/custom-stories', () => HttpResponse.json([])))
    renderSeccion()

    expect(await screen.findByText(/Todavía no has creado ninguna historia/)).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
  })

  it('avisa y deja reintentar si la lista no carga', async () => {
    server.use(http.get('/api/custom-stories', () => HttpResponse.json({ detail: 'Vaya' }, { status: 500 })))
    renderSeccion()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus historias.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('/mis-historias: buscador y filtros', () => {
  it('busca por título sin importar los acentos', async () => {
    const user = userEvent.setup()
    renderSeccion()
    await screen.findByRole('link', { name: DEFINIDA.title })

    const buscador = screen.getByRole('searchbox', { name: 'Buscar por título' })
    await user.click(buscador)
    await user.paste('cafe')

    expect(tarjetas()).toHaveLength(1)
    expect(screen.getByRole('link', { name: DEFINIDA.title })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: CONCEPTO.title })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 historia en pantalla.')
  })

  it('filtra por visibilidad y por modo con radios', async () => {
    const user = userEvent.setup()
    renderSeccion()
    await screen.findByRole('link', { name: DEFINIDA.title })

    await user.click(screen.getByRole('radio', { name: 'Privadas' }))
    expect(tarjetas()).toHaveLength(1)
    expect(screen.getByRole('link', { name: CONCEPTO.title })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Todas' }))
    await user.click(screen.getByRole('radio', { name: 'Definida' }))
    expect(tarjetas()).toHaveLength(1)
    expect(screen.getByRole('link', { name: DEFINIDA.title })).toBeInTheDocument()
  })

  it('el vacío del filtro es distinto y se puede deshacer', async () => {
    const user = userEvent.setup()
    renderSeccion()
    await screen.findByRole('link', { name: DEFINIDA.title })

    await user.click(screen.getByRole('searchbox', { name: 'Buscar por título' }))
    await user.paste('zzzz')

    expect(screen.getByText(/ninguna cuadra con lo que has pedido/)).toBeInTheDocument()
    expect(screen.queryByText(/Todavía no has creado/)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ninguna historia cuadra con la búsqueda.')

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(tarjetas()).toHaveLength(2)
  })
})

describe('/mis-historias: acciones rápidas', () => {
  it('publica al momento y manda solo isPublic', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.patch('/api/custom-stories/:id', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderSeccion()

    const publicar = await screen.findByRole('button', { name: `Publicar ${CONCEPTO.title}` })
    await user.click(publicar)

    // Optimista: la tarjeta ya dice «Pública» antes de que conteste el servidor.
    expect(await screen.findByRole('button', { name: `Despublicar ${CONCEPTO.title}` })).toBeInTheDocument()
    await waitFor(() => expect(body).toEqual({ isPublic: true }))
  })

  it('si el servidor rechaza el cambio, la tarjeta vuelve atrás y lo cuenta', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/custom-stories/:id', () =>
        HttpResponse.json({ detail: 'Historia propia no encontrada.' }, { status: 404 }),
      ),
    )
    renderSeccion()

    await user.click(await screen.findByRole('button', { name: `Publicar ${CONCEPTO.title}` }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Historia propia no encontrada.')
    expect(screen.getByRole('button', { name: `Publicar ${CONCEPTO.title}` })).toBeInTheDocument()
  })

  it('editar y portada llevan al detalle', async () => {
    const user = userEvent.setup()
    renderSeccion()

    await user.click(await screen.findByRole('button', { name: `Editar ${CONCEPTO.title}` }))
    expect(await screen.findByText(`Detalle ${CONCEPTO.id}`)).toBeInTheDocument()
  })

  it('borrar pide confirmación, avisa de las partidas ajenas y devuelve el foco al cancelar', async () => {
    const user = userEvent.setup()
    renderSeccion()

    const borrar = await screen.findByRole('button', { name: `Borrar ${CONCEPTO.title}` })
    await user.click(borrar)

    const dialogo = screen.getByRole('dialog', { name: `¿Borrar «${CONCEPTO.title}»?` })
    expect(within(dialogo).getByText(/sus partidas siguen jugables/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/deja de aparecer en Explorar/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(borrar).toHaveFocus()
  })

  it('al confirmar borra, quita la tarjeta y el foco va al título de la página', async () => {
    const user = userEvent.setup()
    renderSeccion()

    await user.click(await screen.findByRole('button', { name: `Borrar ${CONCEPTO.title}` }))
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    await waitFor(() => expect(screen.queryByRole('link', { name: CONCEPTO.title })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: DEFINIDA.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mis historias' })).toHaveFocus()
  })

  it('si el borrado falla, el diálogo sigue abierto con el motivo', async () => {
    const user = userEvent.setup()
    server.use(
      http.delete('/api/custom-stories/:id', () =>
        HttpResponse.json({ detail: 'Historia propia no encontrada.' }, { status: 404 }),
      ),
    )
    renderSeccion()

    await user.click(await screen.findByRole('button', { name: `Borrar ${CONCEPTO.title}` }))
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Historia propia no encontrada.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
