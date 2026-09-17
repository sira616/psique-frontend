import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/utils'
import { Card } from '@/shared/ui/card'

type DialogProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  /** Mientras se guarda no se cierra con Escape ni pulsando fuera. */
  busy?: boolean
  /** Control que recibe el foco al abrir; por defecto, el primero enfocable. */
  initialFocusRef?: RefObject<HTMLElement | null>
  className?: string
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo modal: atrapa el foco, cierra con Escape y devuelve el foco a quien lo abrió. Sin
 * `<dialog>` nativo porque jsdom no implementa `showModal`.
 */
export function Dialog({ open, title, children, onClose, busy = false, initialFocusRef, className }: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const first = initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel
    first?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [open, initialFocusRef])

  if (!open) return null

  // En el árbol de React el portal sigue dentro de quien lo abre: se corta la propagación para
  // que Escape no cierre también, por ejemplo, la confirmación de releer que hay debajo.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!busy) onClose()
      return
    }
    const panel = panelRef.current
    if (event.key !== 'Tab' || !panel) return
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    const firstItem = items[0]!
    const lastItem = items.at(-1)!
    if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === panel)) {
      event.preventDefault()
      lastItem.focus()
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault()
      firstItem.focus()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
      style={{ background: 'var(--ps-scrim)' }}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('w-full max-w-[28rem] space-y-4 p-5 outline-none sm:p-6', className)}
      >
        <h2 id={titleId} className="font-serif text-headline-lg text-ink">
          {title}
        </h2>
        {children}
      </Card>
    </div>,
    document.body,
  )
}
