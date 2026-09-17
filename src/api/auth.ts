import { apiClient } from '@/shared/lib/apiClient'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

type SessionResponse = {
  access_token: string
  user: AuthUser
}

function storeSession(data: SessionResponse) {
  useAuthStore.getState().setSession({ accessToken: data.access_token, user: data.user })
  return data.user
}

export async function login(username: string, password: string) {
  const data = await apiClient<SessionResponse>('/api/auth/login', {
    method: 'POST',
    body: { login: username, password },
    skipAuthRefresh: true,
  })
  return storeSession(data)
}

/** El backend devuelve ya la sesión al registrarse: no hay que volver a entrar. */
export async function register(username: string, password: string, displayName?: string) {
  const data = await apiClient<SessionResponse>('/api/auth/register', {
    method: 'POST',
    body: { username, password, display_name: displayName || null },
    skipAuthRefresh: true,
  })
  return storeSession(data)
}

/** La cookie la revoca y la borra el backend; aquí solo se olvida el access. */
export async function logout() {
  try {
    await apiClient('/api/auth/logout', { method: 'POST', skipAuthRefresh: true })
  } finally {
    useAuthStore.getState().clearSession()
  }
}
