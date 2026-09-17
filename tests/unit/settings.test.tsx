import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { profileFieldErrors } from '@/api/profile'
import { DEMO_USER } from '@/mocks/fixtures'
import { __resetCustomStories } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { SettingsPage } from '@/pages/Settings'
import { ApiError, apiClient } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

async function loginDemo() {
  const data = await apiClient<{ access_token: string; user: never }>('/api/auth/login', {
    method: 'POST',
    body: { login: DEMO_USER.username, password: DEMO_USER.password },
    skipAuthRefresh: true,
  })
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
}

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function replace(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const control = screen.getByLabelText(label)
  await user.clear(control)
  await user.click(control)
  await user.paste(value)
}

beforeEach(async () => {
  __resetCustomStories()
  await loginDemo()
})

describe('Configuración: perfil', () => {
  it('valida handle, bio y enlace en el cliente sin enviar nada', async () => {
    const user = userEvent.setup()
    let patched = false
    server.use(
      http.patch('/api/me/profile', () => {
        patched = true
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderSettings()
    await screen.findByLabelText('Handle')

    await replace(user, 'Handle', 'X!')
    await replace(user, 'Bio', 'a'.repeat(281))
    await replace(user, 'Enlace', 'ftp://ejemplo.com')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const handle = screen.getByLabelText('Handle')
    expect(handle).toHaveAttribute('aria-invalid', 'true')
    expect(handle).toHaveAccessibleDescription(/De 3 a 30 caracteres: letras minúsculas/)
    expect(handle).toHaveFocus()
    // La bio no se recorta al pegar: se avisa.
    expect(screen.getByLabelText('Bio')).toHaveValue('a'.repeat(281))
    expect(screen.getByLabelText('Bio')).toHaveAccessibleDescription(/como mucho 280 caracteres/)
    expect(screen.getByLabelText('Enlace')).toHaveAccessibleDescription(/http:\/\/ o https:\/\//)
    expect(patched).toBe(false)
  })

  it('lleva el 409 de handle ocupado a su campo', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByLabelText('Handle')

    await replace(user, 'Handle', 'Lucia_P')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const handle = screen.getByLabelText('Handle')
    await waitFor(() => expect(handle).toHaveFocus())
    expect(handle).toHaveAttribute('aria-invalid', 'true')
    expect(handle).toHaveAccessibleDescription(/Ese handle ya está cogido\./)
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los campos marcados.')
  })

  it('muestra en su campo el error de contenido del servidor', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByLabelText('Bio')

    await replace(user, 'Bio', 'Busco escenas de sexo explícito.')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const bio = screen.getByLabelText('Bio')
    await waitFor(() => expect(bio).toHaveAttribute('aria-invalid', 'true'))
    expect(bio).toHaveAccessibleDescription(/para todos los públicos/)
  })

  it('guarda, lo anuncia y actualiza la sesión', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByLabelText('Nombre visible')

    await replace(user, 'Nombre visible', '  Demo   Nueva ')
    await replace(user, 'Handle', 'Demo_Nueva')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cambios guardados.'))
    expect(screen.getByLabelText('Nombre visible')).toHaveValue('Demo Nueva')
    expect(useAuthStore.getState().user).toMatchObject({ displayName: 'Demo Nueva', handle: 'demo_nueva' })
  })
})

describe('Configuración: imágenes y privacidad', () => {
  it('rechaza en el cliente un tipo o un tamaño no válidos', async () => {
    const user = userEvent.setup({ applyAccept: false })
    let uploaded = false
    server.use(
      http.post('/api/me/avatar', () => {
        uploaded = true
        return undefined
      }),
    )
    renderSettings()

    const input = await screen.findByLabelText('Subir foto')
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')

    await user.upload(input, new File(['GIF89a'], 'gato.gif', { type: 'image/gif' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige una imagen JPEG, PNG o WebP.')

    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })
    await user.upload(input, big)
    expect(await screen.findByRole('alert')).toHaveTextContent('como mucho 2 MB')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(uploaded).toBe(false)
  })

  it('cambia la visibilidad de una estantería con un interruptor', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.patch('/api/me/profile', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    renderSettings()

    const toggle = await screen.findByRole('switch', { name: 'Mostrar lo que estoy leyendo' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await waitFor(() => expect(body).toEqual({ showReading: false }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Leyendo queda oculta'))
  })
})

describe('profileFieldErrors', () => {
  it('lee el campo de loc[1], también en los 409 y 413', () => {
    expect(
      profileFieldErrors(
        new ApiError(409, 'Algo ha fallado', {
          detail: [{ loc: ['body', 'handle'], msg: 'Ese handle ya está cogido.', type: 'handle_taken' }],
        }),
      ),
    ).toEqual({ handle: 'Ese handle ya está cogido.' })
    expect(
      profileFieldErrors(new ApiError(413, 'x', { detail: [{ loc: ['body', 'file'], msg: 'Demasiado grande' }] })),
    ).toEqual({ file: 'Demasiado grande' })
    expect(profileFieldErrors(new ApiError(404, 'Perfil no encontrado.', { detail: 'Perfil no encontrado.' }))).toEqual({})
  })
})
