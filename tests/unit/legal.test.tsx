import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LEGAL_VERSION } from '@/content/legal/version'
import { DEMO_USER } from '@/mocks/fixtures'
import { __setTermsAccepted } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import LegalPage from '@/pages/Legal'
import { RegisterPage } from '@/pages/Register'
import { AppShell } from '@/shared/layout/AppShell'
import { apiClient } from '@/shared/lib/apiClient'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

function renderAt(path: string, routes: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: { login: DEMO_USER.username, password: DEMO_USER.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

describe('Registro', () => {
  it('sin las dos casillas no envía y avisa; con ellas manda accept_terms y min_age_confirmed', async () => {
    const user = userEvent.setup()
    const bodies: Record<string, unknown>[] = []
    // Sin respuesta: la petición sigue al handler del mock tras apuntar el cuerpo.
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        bodies.push((await request.clone().json()) as Record<string, unknown>)
      }),
    )
    renderAt('/registro', <Route path="/registro" element={<RegisterPage />} />)

    await user.type(screen.getByLabelText('Usuario'), 'nueva.cuenta')
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveSegura2026')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('aceptar los términos y confirmar que tienes al menos 16 años')
    const terms = screen.getByRole('checkbox', { name: /He leído y acepto los términos/ })
    const age = screen.getByRole('checkbox', { name: 'Tengo al menos 16 años.' })
    expect(terms).toHaveFocus()
    expect(terms).toHaveAttribute('aria-invalid', 'true')
    expect(bodies).toHaveLength(0)
    const termsLinks = screen.getAllByRole('link', { name: /otra pestaña/ })
    expect(termsLinks.map((link) => link.getAttribute('href'))).toEqual(['/terminos', '/privacidad'])
    for (const link of termsLinks) expect(link).toHaveAttribute('target', '_blank')

    await user.click(terms)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('confirmar que tienes al menos 16 años')
    expect(age).toHaveFocus()
    expect(bodies).toHaveLength(0)

    await user.click(age)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await waitFor(() => expect(useAuthStore.getState().user?.username).toBe('nueva.cuenta'))
    expect(bodies[0]).toMatchObject({ username: 'nueva.cuenta', accept_terms: true, min_age_confirmed: true })
    expect(useAuthStore.getState().user?.termsAccepted).toBe(true)
  })

  it('el mock, como el backend, rechaza el registro sin las confirmaciones', async () => {
    await expect(
      apiClient('/api/auth/register', {
        method: 'POST',
        body: { username: 'sin.casillas', password: 'ClaveSegura2026', accept_terms: true, min_age_confirmed: false },
        skipAuthRefresh: true,
      }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('Re-aceptación de términos', () => {
  function renderShell() {
    return renderAt(
      '/',
      <Route element={<AppShell />}>
        <Route path="/" element={<p>Inicio</p>} />
      </Route>,
    )
  }

  it('bloquea con termsAccepted=false, no se cierra con Escape y desaparece al aceptar', async () => {
    const user = userEvent.setup()
    __setTermsAccepted(DEMO_USER.id, false)
    await loginDemo()
    expect(useAuthStore.getState().user?.termsAccepted).toBe(false)
    renderShell()

    const dialog = await screen.findByRole('dialog', { name: 'Hemos actualizado los términos' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('link', { name: /términos de uso/ })).toHaveAttribute('href', '/terminos')
    expect(within(dialog).getByRole('link', { name: /política de privacidad/ })).toHaveAttribute('href', '/privacidad')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Hemos actualizado los términos' })).toBeInTheDocument()

    const accept = within(dialog).getByRole('button', { name: 'Aceptar y seguir' })
    expect(accept).toBeDisabled()
    await user.click(within(dialog).getByRole('checkbox', { name: /tengo al menos 16 años/ }))
    await user.click(accept)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useAuthStore.getState().user?.termsAccepted).toBe(true)
  })

  it('ante un 409 terms_outdated toma la versión nueva y pide aceptar otra vez', async () => {
    const user = userEvent.setup()
    const sent: string[] = []
    server.use(
      http.post('/api/me/accept-terms', async ({ request }) => {
        const { version } = (await request.json()) as { version: string }
        sent.push(version)
        if (version !== '2026-10-01') {
          return HttpResponse.json(
            { code: 'terms_outdated', detail: 'Los términos han cambiado mientras los leías.', termsVersion: '2026-10-01' },
            { status: 409 },
          )
        }
        return HttpResponse.json({ ...useAuthStore.getState().user, termsVersion: '2026-10-01', termsAccepted: true })
      }),
    )
    __setTermsAccepted(DEMO_USER.id, false)
    await loginDemo()
    renderShell()

    const dialog = await screen.findByRole('dialog', { name: 'Hemos actualizado los términos' })
    const checkbox = within(dialog).getByRole('checkbox')
    await user.click(checkbox)
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar y seguir' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Los términos han cambiado mientras los leías.')
    expect(within(dialog).getByText(/la versión 2026-10-01 de los/)).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar y seguir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(sent).toEqual([LEGAL_VERSION, '2026-10-01'])
  })
})

describe('Páginas legales', () => {
  it.each([
    ['/terminos', 'terminos', 'Términos de uso'],
    ['/privacidad', 'privacidad', 'Política de privacidad'],
  ] as const)('%s se lee sin sesión, con el aviso de borrador y la versión', async (path, kind, title) => {
    renderAt(path, <Route path={path} element={<LegalPage kind={kind} />} />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Borrador pendiente de revisión legal.')
    expect(screen.getByText(new RegExp(`Versión ${LEGAL_VERSION}`))).toBeInTheDocument()
    expect(screen.getAllByText(/\[EMAIL DE CONTACTO\]/).length).toBeGreaterThan(0)
  })
})
