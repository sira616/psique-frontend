/** Nombre visible de la moneda. Único sitio donde vive: renombrarla es tocar solo esto. */
export const MONEDA = { singular: 'óbolo', plural: 'óbolos' } as const

export function nombreMoneda(cantidad: number) {
  return Math.abs(cantidad) === 1 ? MONEDA.singular : MONEDA.plural
}

/** "1 óbolo", "5 óbolos". */
export function formatoMoneda(cantidad: number) {
  return `${cantidad} ${nombreMoneda(cantidad)}`
}

/** Con signo explícito para movimientos: "+5 óbolos", "−2 óbolos". */
export function formatoMovimiento(cantidad: number) {
  const signo = cantidad > 0 ? '+' : cantidad < 0 ? '−' : ''
  return `${signo}${Math.abs(cantidad)} ${nombreMoneda(cantidad)}`
}
