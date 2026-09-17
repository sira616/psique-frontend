import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { formatRestrictedUntil } from '@/api/policy'
import { DEMO_USER, POLICY_MESSAGES, seedStoryId } from '@/mocks/fixtures'
import { __resetCustomStories, CLOSED_DEMO_STORY_ID } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { BookPage } from '@/pages/Book'
import { CreateStoryPage } from '@/pages/CreateStory'
import { ExplorePage } from '@/pages/Explore'
import { SettingsPage } from '@/pages/Settings'
import { StoryPage } from '@/pages/Story'
import { StoryArchivePage } from '@/pages/StoryArchive'
import { routes } from '@/router/paths'
import { apiClient } from '@/shared/lib/apiClient'
import type { Story } from '@/shared/lib/events'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

// Libro +18 sembrado en las públicas de Marcos (ver fixtures).
const ADULT_BOOK = `custom:${seedStoryId('user-marcos', 2)}`
const CAFE_BOOK = 'custom:5f0c9d2e7b8a4c1f9e3d6a5b4c3d2e1f'

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: AuthUser }>('/api/auth/login', {
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

function renderAt(path: string, { stubStory = false } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/historia/:storyId" element={stubStory ? <StoryStub /> : <StoryPage />} />
          <Route path="/historia/:storyId/archivo" element={<StoryArchivePage />} />
          <Route path="/libro/:bookId" element={<BookPage />} />
          <Route path={routes.explorar} element={<ExplorePage />} />
          <Route path={routes.nuevaHistoria} element={<CreateStoryPage />} />
          <Route path={routes.configuracion} element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openNewStory() {
  const story = await apiClient<Story>('/api/stories', { method: 'POST', body: { characterId: 'lucia' } })
  renderAt(routes.story(story.id))
  await screen.findByRole('textbox', { name: 'Mensaje' })
  return story
}

async function say(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole('textbox', { name: 'Mensaje' }), text)
  await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
}

beforeEach(async () => {
  // jsdom no implementa scrollIntoView y la partida lo usa para seguir el último mensaje.
  Element.prototype.scrollIntoView ??= () => {}
  __resetCustomStories()
  await loginDemo()
})

describe('partida cerrada', () => {
  it('story_closed avisa, deshabilita compositor y sugerencias y no guarda el mensaje', async () => {
    const user = userEvent.setup()
    await openNewStory()

    await say(user, '#cerrar esto no debería guardarse')

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Esta partida se ha cerrado.')
    expect(notice).toHaveTextContent(POLICY_MESSAGES.closed)
    expect(notice).not.toHaveTextContent('Tu cuenta queda restringida')
    expect(within(notice).getByRole('link', { name: 'Ver en solo lectura' })).toBeInTheDocument()
    const composer = screen.getByRole('textbox', { name: 'Mensaje' })
    expect(composer).toBeDisabled()
    expect(composer).toHaveAttribute('placeholder', 'Esta partida está cerrada')
    for (const choice of within(screen.getByRole('toolbar', { name: 'Sugerencias' })).getAllByRole('button')) {
      expect(choice).toBeDisabled()
    }
    expect(screen.queryByText('#cerrar esto no debería guardarse')).not.toBeInTheDocument()
  })

  it('si el cierre activa la restricción, avisa también con la fecha de fin', async () => {
    const user = userEvent.setup()
    await openNewStory()

    await say(user, '#cerrar-restringir')

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Tu cuenta queda restringida.')
    const until = useAuthStore.getState().user?.restrictedUntil
    expect(until).toBeTruthy()
    expect(notice).toHaveTextContent(`Hasta el ${formatRestrictedUntil(until!)}`)
  })

  it('abrir una partida ya cerrada lleva a la vista de solo lectura con el aviso', async () => {
    renderAt(routes.story(CLOSED_DEMO_STORY_ID))

    expect(await screen.findByText(/Cerrada por incumplir las normas el/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Esta partida se ha cerrado.')
    expect(screen.queryByRole('textbox', { name: 'Mensaje' })).not.toBeInTheDocument()
    expect(screen.queryByRole('toolbar', { name: 'Sugerencias' })).not.toBeInTheDocument()
  })

  it('el historial del libro marca la partida cerrada', async () => {
    renderAt(routes.book(CAFE_BOOK))

    const history = await screen.findByRole('region', { name: 'Tus lecturas anteriores' })
    expect(history).toHaveTextContent('Cerrada por incumplir las normas')
    expect(within(history).getByRole('link', { name: /Ver la conversación/ })).toHaveAttribute(
      'href',
      `/historia/${CLOSED_DEMO_STORY_ID}/archivo`,
    )
  })
})

describe('restricción de cuenta', () => {
  it('account_restricted avisa con la fecha, deshabilita el compositor y devuelve el texto', async () => {
    const user = userEvent.setup()
    await openNewStory()

    await say(user, '#restringir hola')

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Tu cuenta tiene una restricción temporal.')
    const until = useAuthStore.getState().user?.restrictedUntil
    expect(notice).toHaveTextContent(formatRestrictedUntil(until!))
    const composer = screen.getByRole('textbox', { name: 'Mensaje' })
    expect(composer).toBeDisabled()
    await waitFor(() => expect(composer).toHaveValue('#restringir hola'))
  })

  it('en la página de libro explica la restricción en vez de un error suelto', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/stories', () =>
        HttpResponse.json(
          { detail: 'Restringida.', code: 'account_restricted', restrictedUntil: '2099-01-02T10:00:00' },
          { status: 403 },
        ),
      ),
    )
    renderAt(routes.book('lucia'), { stubStory: true })

    await user.click(await screen.findByRole('button', { name: 'Leer gratis' }))
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Tu cuenta tiene una restricción temporal.')
    expect(notice).toHaveTextContent(formatRestrictedUntil('2099-01-02T10:00:00'))
    expect(screen.getByRole('button', { name: 'Leer gratis' })).toBeDisabled()
  })
})

describe('reconducción en +18', () => {
  it('content_redirected avisa, pinta la réplica efímera y devuelve el texto al compositor', async () => {
    const user = userEvent.setup()
    await openNewStory()

    await say(user, '#reconducir algo explícito')

    expect(await screen.findByText(POLICY_MESSAGES.redirected)).toBeInTheDocument()
    expect(await screen.findByText(/A la mañana siguiente, el café ya está hecho/)).toBeInTheDocument()
    expect(screen.getByText('Este momento no queda guardado en la historia.')).toBeInTheDocument()
    const composer = screen.getByRole('textbox', { name: 'Mensaje' })
    await waitFor(() => expect(composer).toHaveValue('#reconducir algo explícito'))
    expect(composer).toBeEnabled()
    expect(screen.queryByText('#reconducir algo explícito', { selector: 'div' })).not.toBeInTheDocument()
  })
})

describe('mayoría de edad', () => {
  it('libro +18 sin confirmar: badge, diálogo accesible y al confirmar reintenta la lectura', async () => {
    const user = userEvent.setup()
    renderAt(routes.book(ADULT_BOOK), { stubStory: true })

    expect(await screen.findByRole('heading', { level: 1, name: 'Después de medianoche' })).toBeInTheDocument()
    expect(screen.getByText('+18')).toBeInTheDocument()

    const read = screen.getByRole('button', { name: 'Leer gratis' })
    await user.click(read)
    let dialog = screen.getByRole('dialog', { name: 'Contenido para mayores de edad' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('declaras que eres mayor de edad')
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(read).toHaveFocus()

    await user.click(read)
    dialog = screen.getByRole('dialog', { name: 'Contenido para mayores de edad' })
    await user.click(within(dialog).getByRole('button', { name: 'Soy mayor de edad' }))

    expect(await screen.findByText(/^Historia story-/)).toBeInTheDocument()
    expect(useAuthStore.getState().user?.adultConfirmed).toBe(true)
  })

  it('un 403 adult_required en el chat abre el diálogo y al confirmar reenvía el mensaje', async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    server.use(
      http.post(
        '/api/stories/:id/chat',
        async ({ request }) => {
          bodies.push(await request.clone().json())
          return HttpResponse.json({ detail: 'Solo +18.', code: 'adult_required' }, { status: 403 })
        },
        { once: true },
      ),
    )
    await openNewStory()

    await say(user, 'Hola de nuevo')
    const dialog = await screen.findByRole('dialog', { name: 'Contenido para mayores de edad' })
    await user.click(within(dialog).getByRole('button', { name: 'Soy mayor de edad' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Hola de nuevo', { selector: 'div' })).toBeInTheDocument()
    expect(bodies).toEqual([{ message: 'Hola de nuevo' }])
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Mensaje' })).toHaveValue(''))
  })

  it('Explorar solo enseña los +18, con su badge, tras confirmar', async () => {
    const user = userEvent.setup()
    const first = renderAt(routes.explorar)
    await screen.findByRole('heading', { name: 'Librería de guardia' })
    await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    await screen.findByText('Has llegado al final.')
    expect(screen.queryByRole('heading', { name: 'Después de medianoche' })).not.toBeInTheDocument()
    first.unmount()

    await apiClient('/api/me/adult-confirmation', { method: 'POST', body: { confirm: true } })
    renderAt(routes.explorar)
    await screen.findByRole('heading', { name: 'Librería de guardia' })
    await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    const card = (await screen.findByRole('heading', { name: 'Después de medianoche' })).closest('li')!
    expect(card).toHaveTextContent('+18')
    expect(within(screen.getByRole('heading', { name: 'Librería de guardia' }).closest('li')!).queryByText('+18')).toBeNull()
  })

  it('Configuración enseña el estado y permite confirmar y retirar', async () => {
    const user = userEvent.setup()
    renderAt(routes.configuracion)

    const section = await screen.findByRole('region', { name: 'Contenido +18' })
    expect(section).toHaveTextContent('no has confirmado que eres mayor de edad')
    await user.click(within(section).getByRole('button', { name: 'Confirmar que soy mayor de edad' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Soy mayor de edad' }))

    await waitFor(() => expect(section).toHaveTextContent('has confirmado que eres mayor de edad.'))
    expect(section).not.toHaveTextContent('no has confirmado')
    await user.click(within(section).getByRole('button', { name: 'Retirar confirmación' }))
    await waitFor(() => expect(section).toHaveTextContent('no has confirmado que eres mayor de edad'))
    expect(useAuthStore.getState().user?.adultConfirmed).toBe(false)
  })
})

describe('opción +18 al crear', () => {
  it('manda adult: true si se marca la casilla', async () => {
    const user = userEvent.setup()
    let body: Record<string, unknown> | undefined
    server.use(
      http.post('/api/custom-stories', async ({ request }) => {
        body = (await request.clone().json()) as Record<string, unknown>
        return undefined
      }),
    )
    renderAt(routes.nuevaHistoria)

    await user.click(screen.getByRole('radio', { name: /Concepto/ }))
    await user.click(screen.getByLabelText('Premisa'))
    await user.paste('Una cartera perdida en el metro de Madrid')
    const adult = screen.getByRole('checkbox', { name: /\+18/ })
    expect(adult).not.toBeChecked()
    expect(adult).toHaveAccessibleDescription(/solo la verán cuentas que han confirmado ser mayores de edad/i)
    await user.click(adult)
    await user.click(screen.getByRole('button', { name: 'Crear historia' }))

    await waitFor(() => expect(body?.adult).toBe(true))
  })
})
