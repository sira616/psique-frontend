import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { updateMyProfile } from '@/api/profile'
import { DEMO_USER } from '@/mocks/fixtures'
import { __resetCustomStories } from '@/mocks/handlers'
import { ProfilePage } from '@/pages/Profile'
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

function renderProfile(handle: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/u/${handle}`]}>
        <Routes>
          <Route path="/u/:handle" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('perfil ajeno', () => {
  it('muestra cabecera y "Publicadas", y un aviso neutro en la estantería oculta', async () => {
    renderProfile('Lucia_P')

    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Pardo' })).toBeInTheDocument()
    expect(screen.getByText('@lucia_p')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Foto de perfil de Lucía Pardo' })).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /ejemplo\.com\/lucia/ })
    expect(link).toHaveAttribute('href', 'https://ejemplo.com/lucia')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')

    const published = screen.getByRole('region', { name: 'Publicadas' })
    expect(within(published).getAllByRole('listitem')).toHaveLength(6)
    expect(within(published).getByRole('link', { name: 'Ver libro: El último tren a Lisboa' })).toHaveAttribute(
      'href',
      `/libro/${encodeURIComponent('custom:userlucia00'.padEnd(39, '0'))}`,
    )

    const reading = screen.getByRole('region', { name: 'Leyendo' })
    expect(reading).toHaveTextContent('Lucía Pardo no comparte lo que está leyendo.')
    expect(within(reading).queryByRole('listitem')).not.toBeInTheDocument()

    expect(screen.queryByText('Oculta para otros')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Editar perfil' })).not.toBeInTheDocument()
  })

  it('sin foto enseña iniciales y respeta las dos estanterías ocultas', async () => {
    renderProfile('marcos_r')

    expect(await screen.findByRole('img', { name: 'Foto de perfil de Marcos Rey' })).toHaveTextContent('MR')
    expect(screen.getByRole('region', { name: 'Publicadas' })).toHaveTextContent('no comparte sus historias publicadas')
    expect(screen.getByRole('region', { name: 'Leyendo' })).toHaveTextContent('no comparte lo que está leyendo')
  })

  it('un handle que no existe da un 404 amable', async () => {
    renderProfile('nadie_aqui')

    expect(await screen.findByRole('heading', { name: 'No encontramos este perfil' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Explorar' })).toHaveAttribute('href', '/explorar')
  })
})

describe('perfil propio', () => {
  it('ve sus estanterías completas, marca las ocultas y enlaza a Configuración', async () => {
    await updateMyProfile({ showReading: false })
    renderProfile(DEMO_USER.handle)

    const reading = await screen.findByRole('region', { name: 'Leyendo' })
    expect(within(reading).getByText('Oculta para otros')).toBeInTheDocument()
    expect(within(reading).getByRole('link', { name: 'Cambiar en Privacidad' })).toHaveAttribute(
      'href',
      '/configuracion#privacidad',
    )

    const published = screen.getByRole('region', { name: 'Publicadas' })
    expect(within(published).queryByText('Oculta para otros')).not.toBeInTheDocument()
    expect(within(published).getByRole('heading', { name: 'Café a medianoche' })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', '/configuracion')
  })
})
