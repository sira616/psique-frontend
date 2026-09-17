import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_USER } from '@/mocks/fixtures'
import { __resetCustomStories } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { ExplorePage } from '@/pages/Explore'
import { routes } from '@/router/paths'
import { apiClient } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: never }>('/api/auth/login', {
    method: 'POST',
    body: { login: DEMO_USER.username, password: DEMO_USER.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

function Stub({ prefix }: { prefix: string }) {
  const params = useParams()
  return <p>{`${prefix} ${Object.values(params).join('')}`}</p>
}

function renderExplore() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[routes.explorar]}>
        <Routes>
          <Route path={routes.explorar} element={<ExplorePage />} />
          <Route path="/u/:handle" element={<Stub prefix="Perfil" />} />
          <Route path="/historia/:storyId" element={<Stub prefix="Historia" />} />
          <Route path="/libro/:bookId" element={<Stub prefix="Libro" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function cardFor(title: string) {
  return screen.getByRole('heading', { name: title }).closest('li')!
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('Explorar', () => {
  it('lista las públicas con su autor y pagina con "Cargar más"', async () => {
    const user = userEvent.setup()
    renderExplore()

    const list = await screen.findByRole('region', { name: 'Historias públicas' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(12)

    // Concepto: solo título, gancho y tono; nada del perfil.
    const concept = cardFor('El último tren a Lisboa')
    expect(concept).toHaveTextContent('Por descubrir')
    expect(concept).toHaveTextContent('nostálgico')
    expect(concept).not.toHaveTextContent(/años|null|undefined/)

    const defined = cardFor('Librería de guardia')
    expect(defined).toHaveTextContent('Inés Galán')
    expect(within(defined).getByRole('link', { name: /Lucía Pardo/ })).toHaveAttribute('href', '/u/lucia_p')

    await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByRole('heading', { name: 'Café a medianoche' })).toBeInTheDocument()
    expect(within(cardFor('Café a medianoche')).getByText('Tuya')).toBeInTheDocument()
    expect(within(list).getAllByRole('listitem')).toHaveLength(15)
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
    expect(screen.getByText('Has llegado al final.')).toHaveFocus()
  })

  it('filtra por modo con un grupo de radios accesible', async () => {
    const user = userEvent.setup()
    const modes: (string | null)[] = []
    server.use(
      http.get('/api/explore', ({ request }) => {
        modes.push(new URL(request.url).searchParams.get('mode'))
        return undefined
      }),
    )
    renderExplore()
    await screen.findByRole('heading', { name: 'Librería de guardia' })

    const group = screen.getByRole('group', { name: 'Tipo de historia' })
    await user.click(within(group).getByRole('radio', { name: 'Por descubrir' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Librería de guardia' })).not.toBeInTheDocument())
    const items = within(await screen.findByRole('region', { name: 'Historias públicas' })).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    for (const item of items) expect(item).toHaveTextContent('Por descubrir')
    expect(within(group).getByRole('radio', { name: 'Por descubrir' })).toBeChecked()
    expect(modes).toEqual([null, 'concepto'])
  })

  it('el enlace del autor lleva a su perfil', async () => {
    const user = userEvent.setup()
    renderExplore()

    const card = await screen.findByRole('heading', { name: 'Clases de tango los jueves' })
    await user.click(within(card.closest('li')!).getByRole('link', { name: /@nora_v/ }))
    expect(await screen.findByText('Perfil nora_v')).toBeInTheDocument()
  })

  it('la tarjeta lleva a la página del libro en vez de empezar la partida', async () => {
    const user = userEvent.setup()
    let started = false
    server.use(
      http.post('/api/stories', () => {
        started = true
        return undefined
      }),
    )
    renderExplore()

    const link = await screen.findByRole('link', { name: 'Ver libro: Radio pirata' })
    expect(link.getAttribute('href')).toMatch(/^\/libro\/custom%3Ausernora04/)
    await user.click(link)
    expect(await screen.findByText(/^Libro custom:usernora04/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Leer/ })).not.toBeInTheDocument()
    expect(started).toBe(false)
  })
})
