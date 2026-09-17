import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, screen, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetCustomStories, ARCHIVED_DEMO_STORY_ID, LOCKED_DEMO_STORY_ID } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { StoryPage } from '@/pages/Story'
import { StoryArchivePage } from '@/pages/StoryArchive'
import { StoryStatus } from '@/features/story/StoryStatus'
import { useStoryStream } from '@/features/story/useStoryStream'
import { apiClient } from '@/shared/lib/apiClient'
import type { Story } from '@/shared/lib/events'
import { passwordProblem } from '@/pages/Register'
import { safeInternalPath } from '@/pages/Login'
import { DEMO_USER } from '@/mocks/fixtures'
import { useAuthStore } from '@/stores/authStore'

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: never }>('/api/auth/login', {
    method: 'POST',
    body: { login: DEMO_USER.username, password: DEMO_USER.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({
    accessToken: data.access_token,
    user: data.user,
  })
}

describe('StoryStatus', () => {
  it('marca la fase actual y expone la afinidad como medidor accesible', () => {
    render(
      <StoryStatus
        state={{
          phase: 'confianza',
          phaseLabel: 'Confianza',
          phaseIndex: 1,
          phaseCount: 5,
          affinity: 142,
          turnCount: 6,
          quickChoices: [],
        }}
      />,
    )
    expect(screen.getByText('Confianza').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('meter', { name: 'Afinidad' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('en la barra lateral mantiene la misma semántica de fase y afinidad', () => {
    render(
      <StoryStatus
        layout="panel"
        state={{
          phase: 'tension',
          phaseLabel: 'Tensión',
          phaseIndex: 2,
          phaseCount: 5,
          affinity: 40,
          turnCount: 9,
          quickChoices: [],
        }}
      />,
    )
    expect(screen.getByText('Tensión').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('meter', { name: 'Afinidad' })).toHaveAttribute('aria-valuenow', '40')
  })
})

describe('useStoryStream', () => {
  it('acumula tokens y aplica el estado que manda el servidor', async () => {
    await loginDemo()
    const story = await apiClient<Story>('/api/stories', { method: 'POST', body: { characterId: 'lucia' } })

    const { result } = renderHook(() => useStoryStream(story.id))
    act(() => result.current.seed(story.messages, story.state))

    await act(async () => {
      await result.current.send({ message: 'Hola, vengo por un libro.' })
    })

    await waitFor(() => expect(result.current.streaming).toBe(false))
    const roles = result.current.messages.map((m) => m.role)
    expect(roles).toEqual(['assistant', 'user', 'assistant'])
    expect(result.current.messages.at(-1)?.content.length).toBeGreaterThan(10)
    expect(result.current.state?.turnCount).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('al elegir una sugerencia enseña el texto real que se guarda, no la etiqueta', async () => {
    await loginDemo()
    const story = await apiClient<Story>('/api/stories', { method: 'POST', body: { characterId: 'lucia' } })
    // Puede ser la partida activa de otro test: cualquier sugerencia vale mientras su texto no sea la etiqueta.
    const choice = story.state.quickChoices[0]!
    expect(choice.message).not.toBe(choice.label)
    let sent: unknown = null
    server.events.on('request:start', async ({ request }) => {
      if (request.url.endsWith('/chat')) sent = await request.clone().json()
    })

    const { result } = renderHook(() => useStoryStream(story.id))
    act(() => result.current.seed(story.messages, story.state))
    let pending: Promise<void>
    act(() => {
      pending = result.current.send({ choiceId: choice.id, message: choice.message })
    })
    // Optimista: antes de que el servidor responda ya está el texto definitivo.
    expect(result.current.messages.at(-2)).toMatchObject({ role: 'user', content: choice.message })
    await act(async () => {
      await pending
    })
    server.events.removeAllListeners()

    const shown = result.current.messages.filter((m) => m.role === 'user').at(-1)?.content
    expect(shown).toBe(choice.message)
    expect(sent).toEqual({ choiceId: choice.id })
    const reloaded = await apiClient<Story>(`/api/stories/${story.id}`)
    expect(reloaded.messages.filter((m) => m.role === 'user').at(-1)?.content).toBe(shown)
  })
})

describe('validaciones de formulario', () => {
  it('replica la política de contraseñas del backend', () => {
    expect(passwordProblem('corta1A')).toMatch(/12/)
    expect(passwordProblem('todominusculas123')).toMatch(/mayúscula/)
    expect(passwordProblem('ContrasenaLarga123')).toBeNull()
  })

  it('solo redirige a rutas internas tras el login', () => {
    expect(safeInternalPath('/historia/1')).toBe('/historia/1')
    expect(safeInternalPath('//evil.example')).toBeNull()
    expect(safeInternalPath('https://evil.example')).toBeNull()
  })
})

describe('capítulo bloqueado', () => {
  function renderStory(path: string) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/historia/:storyId" element={<StoryPage />} />
            <Route path="/historia/:storyId/archivo" element={<StoryArchivePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  beforeEach(async () => {
    // jsdom no implementa scrollIntoView y la partida lo usa para seguir el último mensaje.
    Element.prototype.scrollIntoView ??= () => {}
    __resetCustomStories()
    await loginDemo()
  })

  it('deshabilita compositor y sugerencias y deja solo el aviso de desbloqueo', async () => {
    renderStory(`/historia/${LOCKED_DEMO_STORY_ID}`)

    const composer = await screen.findByRole('textbox', { name: 'Mensaje' })
    expect(composer).toBeDisabled()
    expect(composer).toHaveAttribute('placeholder', 'Desbloquea el capítulo para seguir')
    const choices = within(screen.getByRole('toolbar', { name: 'Sugerencias' })).getAllByRole('button')
    expect(choices.length).toBeGreaterThan(0)
    for (const choice of choices) expect(choice).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('El siguiente capítulo está bloqueado.')
    expect(await screen.findByRole('button', { name: /Desbloquear capítulo/ })).toBeEnabled()
  })

  it('muestra la escena sobre las sugerencias y la actualiza con cada turno', async () => {
    const story = await apiClient<Story>('/api/stories', { method: 'POST', body: { characterId: 'lucia' } })
    renderStory(`/historia/${story.id}`)

    const toolbar = await screen.findByRole('toolbar', { name: 'Sugerencias' })
    expect(toolbar).toHaveAccessibleDescription(`Escena: ${story.state.scene}`)
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Presentarte' }))

    expect(await screen.findByText('Por cierto, no me he presentado. Es un placer conocerte.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('toolbar', { name: 'Sugerencias' })).toHaveAccessibleDescription(
        'Escena: En el taller: la carta escondida',
      ),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preguntar por la carta' })).toBeEnabled())
  })

  it('con un 409 chapter_locked aplica el estado recibido sin dejar mensajes fantasma', async () => {
    const story = await apiClient<Story>('/api/stories', { method: 'POST', body: { characterId: 'lucia' } })
    const locked = { ...story.state, chapter_locked: true, next_phase: 'confianza', chapter_cost: 2 }
    server.use(
      http.post('/api/stories/:id/chat', () =>
        HttpResponse.json(
          {
            detail: 'Este capítulo está bloqueado. Desbloquéalo para seguir la historia.',
            code: 'chapter_locked',
            state: locked,
          },
          { status: 409 },
        ),
      ),
    )

    const { result } = renderHook(() => useStoryStream(story.id))
    act(() => result.current.seed(story.messages, story.state))
    await act(async () => {
      await result.current.send({ message: '¿Seguimos?' })
    })

    expect(result.current.messages.map((m) => m.content)).toEqual(story.messages.map((m) => m.content))
    expect(result.current.state?.chapter_locked).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.streaming).toBe(false)
  })

  it('una partida archivada redirige a su vista de solo lectura', async () => {
    renderStory(`/historia/${ARCHIVED_DEMO_STORY_ID}`)

    expect(await screen.findByText(/Lectura archivada/)).toBeInTheDocument()
    expect(screen.getByText('Si todavía queda algo de cena, me quedo.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Mensaje' })).not.toBeInTheDocument()
    expect(screen.queryByRole('toolbar', { name: 'Sugerencias' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al libro' })).toHaveAttribute('href', '/libro/mateo')
  })
})
