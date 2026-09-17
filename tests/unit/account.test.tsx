import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportFileName } from '@/api/account'
import { DEMO_USER, DEV_USER } from '@/mocks/fixtures'
import { __resetCustomStories, __setTurnsUsed } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { SettingsPage } from '@/pages/Settings'
import { StoryPage } from '@/pages/Story'
import { AppShell } from '@/shared/layout/AppShell'
import { apiClient } from '@/shared/lib/apiClient'
import type { Story } from '@/shared/lib/events'
import { useAuthStore } from '@/stores/authStore'

async function login(account: { username: string; password: string }) {
  const data = await apiClient<{ access_token: string; user: never }>('/api/auth/login', {
    method: 'POST',
    body: { login: account.username, password: account.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

function renderAt(path: string, routes: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes}
          <Route path="/login" element={<p>Pantalla de entrada</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function newStory() {
  return apiClient<Story>('/api/stories', { method: 'POST', body: { characterId: 'lucia' } })
}

function renderStory(id: string) {
  return renderAt(`/historia/${id}`, <Route path="/historia/:storyId" element={<StoryPage />} />)
}

beforeEach(() => {
  Element.prototype.scrollIntoView ??= () => {}
  __resetCustomStories()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Límite diario de turnos', () => {
  beforeEach(async () => {
    await login(DEMO_USER)
  })

  it('con el cupo agotado avisa y deshabilita compositor y sugerencias', async () => {
    const story = await newStory()
    __setTurnsUsed(DEMO_USER.id, 60)
    renderStory(story.id)

    expect(await screen.findByText('Has llegado al límite de turnos de hoy.')).toBeInTheDocument()
    const composer = screen.getByRole('textbox', { name: 'Mensaje' })
    expect(composer).toBeDisabled()
    expect(composer).toHaveAttribute('placeholder', 'Límite de turnos de hoy alcanzado')
    for (const choice of within(screen.getByRole('toolbar', { name: 'Sugerencias' })).getAllByRole('button')) {
      expect(choice).toBeDisabled()
    }
  })

  it('con pocos turnos muestra cuántos quedan, y al recibir el 429 avisa y devuelve el borrador', async () => {
    const user = userEvent.setup()
    const story = await newStory()
    __setTurnsUsed(DEMO_USER.id, 52)
    renderStory(story.id)
    expect(await screen.findByText('Te quedan 8 turnos hoy.')).toBeInTheDocument()

    server.use(
      http.post('/api/stories/:id/chat', () =>
        HttpResponse.json(
          { detail: 'Límite', code: 'daily_turn_limit', resetsAt: '2099-01-01T00:00:00+01:00', turnsLimit: 60 },
          { status: 429 },
        ),
      ),
    )
    const composer = screen.getByRole('textbox', { name: 'Mensaje' })
    await user.type(composer, 'Hola otra vez')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Has llegado al límite de turnos de hoy.')
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Mensaje' })).toBeDisabled())
    expect(screen.getByRole('textbox', { name: 'Mensaje' })).toHaveValue('Hola otra vez')
    expect(screen.queryByText('Hola otra vez', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('sin pocos turnos no enseña contador', async () => {
    const story = await newStory()
    renderStory(story.id)
    await screen.findByRole('textbox', { name: 'Mensaje' })
    await waitFor(() => expect(screen.queryByText(/turnos? hoy/)).not.toBeInTheDocument())
  })
})

describe('Configuración: tus datos', () => {
  beforeEach(async () => {
    await login(DEMO_USER)
  })

  function renderSettings() {
    return renderAt('/configuracion', <Route path="/configuracion" element={<SettingsPage />} />)
  }

  it('descarga los datos como JSON', async () => {
    const user = userEvent.setup()
    const exported = vi.fn()
    server.use(
      http.get('/api/me/export', () => {
        exported()
        return HttpResponse.json({ format: 'psique-export-1' })
      }),
    )
    const createObjectURL = vi.fn(() => 'blob:psique')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Descargar mis datos' }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(exported).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalled()
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(exportFileName('demo'))
  })

  it('borrar la cuenta valida contraseña y BORRAR, informa del error y al borrar cierra sesión', async () => {
    const user = userEvent.setup()
    // Sin sustituir el handler: el del mock borra la cuenta y su cookie, y así un refresh posterior falla como en el backend.
    const deletes: unknown[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'DELETE' && new URL(request.url).pathname === '/api/me') deletes.push(await request.clone().json())
    })
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Borrar cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Borrar tu cuenta' })
    const submit = within(dialog).getByRole('button', { name: 'Borrar mi cuenta' })

    await user.click(submit)
    expect(within(dialog).getByLabelText('Contraseña actual')).toHaveAccessibleDescription('Escribe tu contraseña actual.')
    expect(within(dialog).getByLabelText('Escribe BORRAR para confirmar')).toHaveAttribute('aria-invalid', 'true')
    expect(deletes).toHaveLength(0)

    await user.type(within(dialog).getByLabelText('Contraseña actual'), 'mala')
    await user.type(within(dialog).getByLabelText('Escribe BORRAR para confirmar'), 'borrar')
    await user.click(submit)
    expect(deletes).toHaveLength(0)

    await user.clear(within(dialog).getByLabelText('Escribe BORRAR para confirmar'))
    await user.type(within(dialog).getByLabelText('Escribe BORRAR para confirmar'), 'BORRAR')
    await user.click(submit)
    expect(await within(dialog).findByText('La contraseña no es correcta.')).toBeInTheDocument()
    expect(useAuthStore.getState().user).not.toBeNull()

    await user.clear(within(dialog).getByLabelText('Contraseña actual'))
    await user.type(within(dialog).getByLabelText('Contraseña actual'), DEMO_USER.password)
    await user.click(submit)

    expect(await screen.findByText('Pantalla de entrada')).toBeInTheDocument()
    expect(deletes.at(-1)).toEqual({ password: DEMO_USER.password, confirmation: 'BORRAR' })
    expect(useAuthStore.getState().accessToken).toBeNull()
    server.events.removeAllListeners()
  })
})

describe('Herramientas de dev', () => {
  function renderShell(path: string) {
    return renderAt(
      path,
      <Route element={<AppShell />}>
        <Route path="/historia/:storyId" element={<StoryPage />} />
        <Route path="/" element={<p>Inicio</p>} />
      </Route>,
    )
  }

  it('no aparecen para una cuenta normal', async () => {
    await login(DEMO_USER)
    const story = await newStory()
    renderShell(`/historia/${story.id}`)
    await screen.findByRole('textbox', { name: 'Mensaje' })
    expect(screen.queryByRole('link', { name: 'Dev' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dev' })).not.toBeInTheDocument()
  })

  it('para dev: entrada en la nav y panel que llama a los endpoints y refresca el estado', async () => {
    const user = userEvent.setup()
    await login(DEV_USER)
    const story = await newStory()
    const calls: string[] = []
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/api/dev/')) calls.push(`${request.method} ${url.pathname}`)
    })
    renderShell(`/historia/${story.id}`)

    expect(await screen.findByRole('link', { name: 'Dev' })).toHaveAttribute('href', '/dev')
    await user.click(await screen.findByRole('button', { name: 'Dev' }))
    const dialog = await screen.findByRole('dialog', { name: 'Herramientas de dev' })

    await user.selectOptions(await within(dialog).findByLabelText('Fase destino'), 'tension')
    await user.click(within(dialog).getByRole('button', { name: 'Forzar' }))
    expect(await within(dialog).findByText('Forzar fase: hecho.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Sumar 5 de afinidad' }))
    expect(await within(dialog).findByText('Sumar afinidad: hecho.')).toBeInTheDocument()
    expect(within(dialog).getByText(`Afinidad (ahora ${story.state.affinity + 5})`)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Dar' }))
    expect(await within(dialog).findByText('Dar óbolos: hecho.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Ver contexto' }))
    const context = await screen.findByRole('dialog', { name: 'Contexto del modelo' })
    expect(within(context).getByText(/Prompt simulado/)).toBeInTheDocument()

    expect(calls).toEqual([
      `POST /api/dev/stories/${story.id}/phase`,
      `POST /api/dev/stories/${story.id}/affinity`,
      'POST /api/dev/obolos',
      `GET /api/dev/stories/${story.id}/context`,
    ])
    server.events.removeAllListeners()
  })
})
