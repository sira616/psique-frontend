import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Wallet } from '@/api/economy'
import { DEMO_USER } from '@/mocks/fixtures'
import { __resetCustomStories, ARCHIVED_DEMO_STORY_ID, LOCKED_DEMO_STORY_ID } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { BookPage } from '@/pages/Book'
import { routes } from '@/router/paths'
import { apiClient } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

// Historia pública de Nora con la primera lectura de pago (ver fixtures).
const RADIO_PIRATA = `custom:${'usernora04'.padEnd(32, '0')}`

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

function renderBook(bookId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[routes.book(bookId)]}>
        <Routes>
          <Route path="/libro/:bookId" element={<BookPage />} />
          <Route path="/historia/:storyId" element={<StoryStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('página de libro: acciones', () => {
  it('sin empezar y gratis ofrece "Leer gratis", sin releer, y abre la partida', async () => {
    const user = userEvent.setup()
    renderBook('lucia')

    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Ferrer' })).toBeInTheDocument()
    expect(screen.getByText('Psique')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Releer/ })).not.toBeInTheDocument()
    expect(await screen.findByText(/Tienes 5 óbolos/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Leer gratis' }))
    expect(await screen.findByText(/^Historia story-/)).toBeInTheDocument()
    const wallet = await apiClient<Wallet>('/api/me/wallet')
    expect(wallet.balance).toBe(5)
  })

  it('sin empezar y de pago enseña el coste, cobra y registra la lectura', async () => {
    const user = userEvent.setup()
    renderBook(RADIO_PIRATA)

    expect(await screen.findByRole('heading', { level: 1, name: 'Radio pirata' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /@nora_v/ })).toHaveAttribute('href', '/u/nora_v')

    await user.click(screen.getByRole('button', { name: 'Leer · 3 óbolos' }))
    expect(await screen.findByText(/^Historia story-/)).toBeInTheDocument()
    const wallet = await apiClient<Wallet>('/api/me/wallet')
    expect(wallet.balance).toBe(2)
    expect(wallet.movements[0]).toMatchObject({ amount: -3, reason: 'lectura' })
  })

  it('leyendo ofrece "Continuar" a la partida activa y "Releer" con su precio', async () => {
    const user = userEvent.setup()
    renderBook('mateo')

    const continuar = await screen.findByRole('link', { name: 'Continuar' })
    expect(continuar).toHaveAttribute('href', `/historia/${LOCKED_DEMO_STORY_ID}`)
    expect(screen.queryByRole('button', { name: /^Leer/ })).not.toBeInTheDocument()
    expect(screen.getByText(/siguiente capítulo espera/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Releer · 3 óbolos' }))
    const group = screen.getByRole('group', { name: /Empezarás desde el principio/ })
    expect(within(group).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(within(group).getByRole('button', { name: /Sí, releer/ }))

    expect(await screen.findByText(/^Historia story-/)).toBeInTheDocument()
    const old = await apiClient<{ status: string }>(`/api/stories/${LOCKED_DEMO_STORY_ID}`)
    expect(old.status).toBe('archivada')
  })

  it('un 402 muestra el mensaje del servidor y enlaza a Rasca y gana', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/stories', () =>
        HttpResponse.json({ detail: 'Te faltan óbolos para empezar este libro.' }, { status: 402 }),
      ),
    )
    renderBook(RADIO_PIRATA)

    await user.click(await screen.findByRole('button', { name: 'Leer · 3 óbolos' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Te faltan óbolos para empezar este libro.')
    expect(within(alert).getByRole('link', { name: 'Ir a Rasca y gana' })).toHaveAttribute('href', '/rasca-y-gana')
  })

  it('un libro privado o inexistente da un 404 amable', async () => {
    renderBook('custom:no-existe')
    expect(await screen.findByRole('heading', { name: 'No encontramos este libro' })).toBeInTheDocument()
  })
})

describe('página de libro: reseñas', () => {
  it('se puntúa con las flechas del teclado y se envía la reseña', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.put('/api/books/:bookId/reviews/me', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderBook('mateo')

    const group = await screen.findByRole('radiogroup', { name: 'Tu nota' })
    const first = within(group).getByRole('radio', { name: '1 estrella' })
    expect(first).toHaveAttribute('tabindex', '0')
    first.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowLeft}')

    const four = within(group).getByRole('radio', { name: '4 estrellas' })
    expect(four).toHaveAttribute('aria-checked', 'true')
    expect(four).toHaveFocus()

    const text = screen.getByLabelText(/Tu reseña/)
    await user.type(text, 'Muy tierna')
    expect(screen.getByText('10/1000 caracteres')).toBeInTheDocument()
    expect(text).toHaveAccessibleDescription('10/1000 caracteres')

    await user.click(screen.getByRole('button', { name: 'Publicar reseña' }))
    expect(await screen.findByText('Reseña publicada.')).toBeInTheDocument()
    expect(body).toEqual({ rating: 4, text: 'Muy tierna' })
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })

  it('sin nota no envía y marca el error en el grupo de estrellas', async () => {
    const user = userEvent.setup()
    renderBook('mateo')

    await user.click(await screen.findByRole('button', { name: 'Publicar reseña' }))
    const group = screen.getByRole('radiogroup', { name: 'Tu nota' })
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(group).toHaveAccessibleDescription('Elige una nota de 1 a 5 estrellas.')
  })

  it('el 422 del texto se asocia al campo', async () => {
    const user = userEvent.setup()
    renderBook('mateo')

    const group = await screen.findByRole('radiogroup', { name: 'Tu nota' })
    await user.click(within(group).getByRole('radio', { name: '5 estrellas' }))
    await user.type(screen.getByLabelText(/Tu reseña/), 'Tiene una escena sexual explícita')
    await user.click(screen.getByRole('button', { name: 'Publicar reseña' }))

    const text = screen.getByLabelText(/Tu reseña/)
    await waitFor(() => expect(text).toHaveAttribute('aria-invalid', 'true'))
    expect(text).toHaveAccessibleDescription(/todos los públicos/)
  })

  it('sin haberlo empezado explica por qué no hay formulario y lista las reseñas', async () => {
    renderBook('lucia')

    expect(await screen.findByText(/Solo puedes reseñar libros que hayas empezado/)).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(await screen.findByText(/El taller bajo la lluvia/)).toBeInTheDocument()
  })
})

describe('página de libro: historial y recomendados', () => {
  it('muestra el historial privado con enlace al archivo', async () => {
    renderBook('mateo')

    const history = await screen.findByRole('region', { name: 'Tus lecturas anteriores' })
    expect(history).toHaveTextContent('Capítulo 3 de 5')
    expect(history).toHaveTextContent('afinidad final 61')
    expect(within(history).getByRole('link', { name: /Ver la conversación/ })).toHaveAttribute(
      'href',
      `/historia/${ARCHIVED_DEMO_STORY_ID}/archivo`,
    )
  })

  it('sin lecturas archivadas no hay historial', async () => {
    renderBook('lucia')
    await screen.findByRole('heading', { level: 1, name: 'Lucía Ferrer' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leer gratis' })).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Tus lecturas anteriores' })).not.toBeInTheDocument()
  })

  it('los recomendados enlazan a su libro y no incluyen el actual', async () => {
    renderBook(RADIO_PIRATA)

    const section = await screen.findByRole('region', { name: 'También te puede gustar' })
    const links = within(section).getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThanOrEqual(6)
    for (const link of links) expect(link.getAttribute('href')).toMatch(/^\/libro\//)
    expect(links.map((l) => l.getAttribute('href'))).not.toContain(routes.book(RADIO_PIRATA))
  })
})
