import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DEMO_USER, DEV_USER } from '@/mocks/fixtures'
import { __restrictAccount, CLOSED_DEMO_STORY_ID } from '@/mocks/handlers'
import DevModerationPage from '@/pages/DevModeration'
import { SettingsPage } from '@/pages/Settings'
import { StoryArchivePage } from '@/pages/StoryArchive'
import { routes } from '@/router/paths'
import { apiClient } from '@/shared/lib/apiClient'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

async function login(account: { username: string; password: string }) {
  const data = await apiClient<{ access_token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: { login: account.username, password: account.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

function renderAt(path: string, routeElements: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routeElements}</Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderArchive() {
  return renderAt(
    routes.storyArchive(CLOSED_DEMO_STORY_ID),
    <>
      <Route path="/historia/:storyId/archivo" element={<StoryArchivePage />} />
      <Route path="/historia/:storyId" element={<p>Partida abierta</p>} />
    </>,
  )
}

describe('Apelación de la persona usuaria', () => {
  it('en la partida cerrada: abrir, escribir y enviar deja la apelación pendiente', async () => {
    const user = userEvent.setup()
    await login(DEMO_USER)
    renderArchive()

    const section = await screen.findByRole('region', { name: 'Apelación' })
    expect(within(section).getByText('¿Crees que fue un error?')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Apelar' }))

    const field = within(section).getByRole('textbox', { name: 'Tu explicación (opcional)' })
    expect(field).toHaveFocus()
    const text = 'Solo le pedía que me contara cómo acababa la noche.'
    await user.type(field, text)
    expect(within(section).getByText(`${text.length}/500`)).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Enviar apelación' }))

    expect(await within(section).findByText('Apelación pendiente.')).toBeInTheDocument()
    expect(within(section).getByText('Solo le pedía que me contara cómo acababa la noche.')).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Apelar' })).not.toBeInTheDocument()
  })

  it('un texto que no pasa el filtro da un aviso amable y deja reintentar', async () => {
    const user = userEvent.setup()
    await login(DEMO_USER)
    renderArchive()

    const section = await screen.findByRole('region', { name: 'Apelación' })
    await user.click(within(section).getByRole('button', { name: 'Apelar' }))
    await user.type(within(section).getByRole('textbox'), 'No era nada sexual, de verdad')
    await user.click(within(section).getByRole('button', { name: 'Enviar apelación' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent('Cuéntanos qué pasó sin contenido explícito')
    const field = within(section).getByRole('textbox')
    await user.clear(field)
    await user.click(within(section).getByRole('button', { name: 'Enviar apelación' }))
    expect(await within(section).findByText('Apelación pendiente.')).toBeInTheDocument()
  })

  it('con la cuenta restringida, Configuración lista los cierres que cuentan con su apelación', async () => {
    const user = userEvent.setup()
    __restrictAccount(DEMO_USER.id, 7)
    await login(DEMO_USER)
    renderAt(routes.incidentes, <Route path={routes.configuracion} element={<SettingsPage />} />)

    const list = await screen.findByRole('region', { name: 'Cierres que cuentan' })
    const item = (await within(list).findAllByRole('listitem'))[0]!
    expect(within(item).getByRole('link', { name: 'Café a medianoche' })).toHaveAttribute('href', routes.storyArchive(CLOSED_DEMO_STORY_ID))
    expect(within(item).getByText(/Contenido explícito/)).toBeInTheDocument()
    await user.click(within(item).getByRole('button', { name: 'Apelar' }))
    await user.click(within(item).getByRole('button', { name: 'Enviar apelación' }))
    expect(await within(item).findByText('Apelación pendiente.')).toBeInTheDocument()
  })
})

describe('Moderación (dev)', () => {
  function renderModeration(path = routes.moderacion) {
    return renderAt(path, <Route path={routes.moderacion} element={<DevModerationPage />} />)
  }

  it('lista las apelaciones pendientes; el detalle enseña el extracto y aceptar informa de la reapertura', async () => {
    const user = userEvent.setup()
    await login(DEV_USER)
    renderModeration()

    expect(await screen.findByText('1–2 de 2')).toBeInTheDocument()
    const rows = screen.getAllByRole('button', { name: /^#\d/ })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('@lucia_p')
    expect(rows[0]).toHaveTextContent('patron:menores · Apelación pendiente')

    await user.click(rows[0]!)
    const detail = await screen.findByRole('region', { name: 'Incidente #2' })
    expect(await within(detail).findByText(/Extracto simulado del mock/)).toBeInTheDocument()
    expect(within(detail).getByText(/Confidencial: solo para revisar este incidente\. Se borra a los 30 días/)).toBeInTheDocument()
    expect(within(detail).getByText(/nos conocimos en el colegio/)).toBeInTheDocument()

    await user.type(within(detail).getByRole('textbox', { name: 'Nota para la cuenta (opcional)' }), 'Contexto de infancia, sin nada sexual.')
    await user.click(within(detail).getByRole('button', { name: 'Aceptar' }))

    expect(await within(detail).findByText(/Incidente aceptado: deja de contar\. La partida se ha reabierto\./)).toBeInTheDocument()
    expect(within(detail).getByText('Sin extracto (caducado o resuelto).')).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Aceptar' })).toBeDisabled()
    // Resuelto: sale de la cola de pendientes.
    await waitFor(() => expect(screen.getByText('1–1 de 1')).toBeInTheDocument())
  })

  it('un incidente propio no se puede revisar y lo explica', async () => {
    await login(DEV_USER)
    renderModeration(`${routes.moderacion}?incidente=3`)

    const detail = await screen.findByRole('region', { name: 'Incidente #3' })
    const accept = await within(detail).findByRole('button', { name: 'Aceptar' })
    expect(accept).toBeDisabled()
    expect(within(detail).getByRole('button', { name: 'Rechazar' })).toBeDisabled()
    expect(accept).toHaveAccessibleDescription('Es un incidente tuyo: tiene que revisarlo otra persona.')
    expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('filtra por resueltos y por prefijo de regla', async () => {
    const user = userEvent.setup()
    await login(DEV_USER)
    renderModeration()
    await screen.findByText('1–2 de 2')

    await user.selectOptions(screen.getByLabelText('Mostrar'), 'todos')
    expect(await screen.findByText('1–4 de 4')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Regla (prefijo)'), 'llm:')
    expect(await screen.findByText('1–2 de 2')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Mostrar'), 'resueltos')
    expect(await screen.findByText('1–1 de 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /@nora_v/ }))
    const detail = await screen.findByRole('region', { name: 'Incidente #4' })
    expect(await within(detail).findByText('Sin extracto (caducado o resuelto).')).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Aceptar' })).toHaveAccessibleDescription(/Ya revisado por @dev/)
  })

  it('una cuenta normal no entra', async () => {
    await login(DEMO_USER)
    renderAt(
      routes.moderacion,
      <>
        <Route path={routes.moderacion} element={<DevModerationPage />} />
        <Route path="/" element={<p>Inicio</p>} />
      </>,
    )
    expect(await screen.findByText('Inicio')).toBeInTheDocument()
  })
})
