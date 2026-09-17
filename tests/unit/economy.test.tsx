import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Wallet } from '@/api/economy'
import { walletQueryKey } from '@/features/economy/useWallet'
import { ChapterLockNotice } from '@/features/story/ChapterLockNotice'
import { DEMO_USER } from '@/mocks/fixtures'
import { __resetCustomStories, LOCKED_DEMO_STORY_ID } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { resultMessage, ScratchGamePage } from '@/pages/ScratchGame'
import { formatoMoneda, formatoMovimiento } from '@/shared/economy/moneda'
import { AppShell } from '@/shared/layout/AppShell'
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

function renderWithProviders(ui: ReactNode, path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('moneda', () => {
  it('formatea singular, plural y signo desde un único sitio', () => {
    expect(formatoMoneda(1)).toBe('1 óbolo')
    expect(formatoMoneda(5)).toBe('5 óbolos')
    expect(formatoMovimiento(-2)).toBe('−2 óbolos')
    expect(resultMessage({ number: 3, won: false, prize: 0 })).toBe('Ha salido un 3. Sin premio esta vez.')
  })
})

describe('Cabecera: saldo', () => {
  it('muestra el saldo como enlace a Rasca y gana', async () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<p>Inicio</p>} />
        </Route>
      </Routes>,
    )
    const link = await screen.findByRole('link', { name: '5 óbolos, ir a Rasca y gana' })
    expect(link).toHaveAttribute('href', '/rasca-y-gana')
  })
})

describe('Rasca y gana', () => {
  it('rasca con el teclado, llama a reveal y anuncia el resultado', async () => {
    const user = userEvent.setup()
    const reveal = vi.fn()
    server.use(
      http.post('/api/scratch-cards/:id/reveal', ({ params }) => {
        reveal(params.id)
        return HttpResponse.json({ id: Number(params.id), number: 7, won: true, prize: 5, balance: 10, remaining: 2 })
      }),
    )
    renderWithProviders(<ScratchGamePage />)

    await user.click(await screen.findByRole('button', { name: 'Sacar tarjeta' }))
    const scratchAll = await screen.findByRole('button', { name: 'Rascar todo' })
    // Tapada, la tarjeta no lleva el número: solo lo trae la respuesta de reveal.
    expect(screen.queryByTestId('numero-tarjeta')).not.toBeInTheDocument()
    expect(reveal).not.toHaveBeenCalled()

    scratchAll.focus()
    await user.keyboard('{Enter}')

    const live = await screen.findByText('Ha salido un 7: ¡ganas 5 óbolos!')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('numero-tarjeta')).toHaveTextContent('7')
  })

  it('sin cupo lo dice con calma y no ofrece sacar tarjeta', async () => {
    server.use(
      http.get('/api/scratch-cards/today', () =>
        HttpResponse.json({ remaining: 0, daily_limit: 3, prize: 5, winning_number: 7, pending_card: null }),
      ),
    )
    renderWithProviders(<ScratchGamePage />)
    expect(await screen.findByText(/Por hoy ya no quedan tarjetas/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sacar tarjeta' })).not.toBeInTheDocument()
  })

  it('lista los movimientos con motivo legible y signo', async () => {
    renderWithProviders(<ScratchGamePage />)
    expect(await screen.findByText('Regalo de bienvenida')).toBeInTheDocument()
    expect(screen.getByText('+5 óbolos')).toBeInTheDocument()
  })
})

describe('Aviso de capítulo bloqueado', () => {
  it('ofrece desbloquear con el coste y, al hacerlo, aplica estado y saldo', async () => {
    const user = userEvent.setup()
    const onUnlocked = vi.fn()
    const { queryClient } = renderWithProviders(
      <ChapterLockNotice storyId={LOCKED_DEMO_STORY_ID} cost={2} onUnlocked={onUnlocked} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/no avanzará/)

    await waitFor(() => expect(queryClient.getQueryData<Wallet>(walletQueryKey)?.balance).toBe(5))
    await user.click(screen.getByRole('button', { name: 'Desbloquear capítulo · 2 óbolos' }))

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1))
    const state = onUnlocked.mock.calls[0]![0]
    expect(state.chapter_locked).toBe(false)
    expect(state).not.toHaveProperty('balance')
    await waitFor(() => expect(queryClient.getQueryData<Wallet>(walletQueryKey)?.balance).toBe(3))
  })

  it('si el saldo no alcanza, enlaza a Rasca y gana en vez del botón', async () => {
    server.use(http.get('/api/me/wallet', () => HttpResponse.json({ balance: 1, movements: [] })))
    renderWithProviders(<ChapterLockNotice storyId={LOCKED_DEMO_STORY_ID} cost={2} onUnlocked={() => {}} />)
    const link = await screen.findByRole('link', { name: 'Consigue óbolos en Rasca y gana' })
    expect(link).toHaveAttribute('href', '/rasca-y-gana')
    expect(screen.queryByRole('button', { name: /Desbloquear/ })).not.toBeInTheDocument()
  })

  it('muestra el detail del 402', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/stories/:id/unlock-chapter', () =>
        HttpResponse.json({ detail: 'No te llega para este capítulo.' }, { status: 402 }),
      ),
    )
    renderWithProviders(<ChapterLockNotice storyId={LOCKED_DEMO_STORY_ID} cost={2} onUnlocked={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Desbloquear capítulo · 2 óbolos' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No te llega para este capítulo.')
  })
})
