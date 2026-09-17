import { Coins } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useWallet } from '@/features/economy/useWallet'
import { routes } from '@/router/paths'
import { formatoMoneda } from '@/shared/economy/moneda'
import { cn } from '@/shared/lib/utils'

/** Saldo en la cabecera. Lleva al minijuego, que es donde se consiguen. */
export function WalletBadge() {
  const wallet = useWallet()
  const balance = wallet.data?.balance
  // Sin datos aún no se enseña un 0 que parecería real.
  if (balance === undefined) return null

  return (
    <NavLink
      to={routes.rascaYGana}
      aria-label={`${formatoMoneda(balance)}, ir a Rasca y gana`}
      className={({ isActive }) =>
        cn(
          'inline-flex min-h-touch items-center gap-1.5 rounded-full px-2.5 text-body-sm font-semibold tabular-nums hover:bg-surf-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]',
          isActive ? 'text-ink' : 'text-ink-dim hover:text-ink',
        )
      }
    >
      <Coins size={18} aria-hidden className="text-gold" />
      <span>{balance}</span>
    </NavLink>
  )
}
