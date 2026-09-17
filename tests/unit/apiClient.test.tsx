import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { apiClient, ApiError, refreshSession } from '@/shared/lib/apiClient'
import { logout } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { server } from '@/mocks/server'
import { __failNextRefresh } from '@/mocks/handlers'
import { DEMO_USER } from '@/mocks/fixtures'

const user = {
  id: DEMO_USER.id,
  username: DEMO_USER.username,
  displayName: DEMO_USER.displayName,
  handle: DEMO_USER.handle,
  isDev: false,
}

describe('apiClient: refresco de sesión', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
  })

  it('ante un 401 refresca una vez y reintenta', async () => {
    // El login deja la cookie de refresh; el access caducado obliga a canjearla.
    await apiClient('/api/auth/login', {
      method: 'POST',
      body: { login: DEMO_USER.username, password: DEMO_USER.password },
      skipAuthRefresh: true,
    })
    useAuthStore.getState().setSession({ accessToken: 'caducado', user })

    let hits = 0
    server.use(
      http.get('/api/characters', ({ request }) => {
        hits += 1
        if (request.headers.get('Authorization') === 'Bearer caducado') {
          return HttpResponse.json({ detail: 'caducado' }, { status: 401 })
        }
        return HttpResponse.json([])
      }),
    )

    expect(await apiClient<unknown[]>('/api/characters')).toEqual([])
    expect(hits).toBe(2)
    expect(useAuthStore.getState().accessToken).not.toBe('caducado')
  })

  it('si el refresco falla, cierra la sesión', async () => {
    useAuthStore.getState().setSession({ accessToken: 'caducado', user })
    __failNextRefresh()
    server.use(http.get('/api/me', () => HttpResponse.json({ detail: 'caducado' }, { status: 401 })))

    await expect(apiClient('/api/me')).rejects.toBeInstanceOf(ApiError)
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})

describe('restaurar la sesión al recargar', () => {
  it('con cookie de refresh, recupera access y usuario sin volver a entrar', async () => {
    await apiClient('/api/auth/login', {
      method: 'POST',
      body: { login: DEMO_USER.username, password: DEMO_USER.password },
      skipAuthRefresh: true,
    })
    // Una recarga borra la memoria pero no la cookie.
    useAuthStore.getState().clearSession()

    expect(await refreshSession()).toBe(true)
    expect(useAuthStore.getState().accessToken).toBeTruthy()
    expect(useAuthStore.getState().user?.username).toBe(DEMO_USER.username)
  })

  it('tras cerrar sesión, recargar no la recupera', async () => {
    await apiClient('/api/auth/login', {
      method: 'POST',
      body: { login: DEMO_USER.username, password: DEMO_USER.password },
      skipAuthRefresh: true,
    })
    await logout()

    expect(await refreshSession()).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
