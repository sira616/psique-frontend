import { useQuery, type QueryClient } from '@tanstack/react-query'
import { fetchWallet, type Wallet } from '@/api/economy'
import { useAuthStore } from '@/stores/authStore'

export const walletQueryKey = ['wallet'] as const
export const scratchTodayQueryKey = ['scratch-cards', 'today'] as const

export function useWallet() {
  const user = useAuthStore((s) => s.user)
  return useQuery({ queryKey: walletQueryKey, queryFn: fetchWallet, enabled: Boolean(user) })
}

/**
 * Pone ya el saldo que devolvió el servidor (la cabecera cambia sin esperar) y pide el
 * wallet de nuevo para traer el movimiento nuevo.
 */
export function applyBalance(queryClient: QueryClient, balance: number) {
  queryClient.setQueryData<Wallet>(walletQueryKey, (old) => (old ? { ...old, balance } : old))
  void queryClient.invalidateQueries({ queryKey: walletQueryKey })
}
