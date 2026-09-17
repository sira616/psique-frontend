import { create } from 'zustand'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  /** Dirección pública del perfil (`/u/<handle>`). No sirve para entrar: eso es `username`. */
  handle: string
  isDev: boolean
}

type AuthState = {
  accessToken: string | null
  user: AuthUser | null
  setSession: (payload: { accessToken: string; user: AuthUser }) => void
  clearSession: () => void
  patchUser: (changes: Partial<Pick<AuthUser, 'displayName' | 'handle'>>) => void
}

/**
 * El access token vive solo en memoria. El refresh va en una cookie httpOnly que este
 * código ni ve: al recargar, `restoreSession` la canjea por un access nuevo.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
  patchUser: (changes) => set((state) => (state.user ? { user: { ...state.user, ...changes } } : {})),
}))
