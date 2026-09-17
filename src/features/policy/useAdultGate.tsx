import { useCallback, useRef, useState } from 'react'
import { AdultConfirmDialog } from '@/features/policy/AdultConfirmDialog'

/**
 * Pide la confirmación de mayoría de edad y, al darla, repite la acción que la necesitaba.
 * Se usa con `viewer.adultRequired` antes de pedir o tras un 403 `adult_required`.
 */
export function useAdultGate() {
  const [open, setOpen] = useState(false)
  const retryRef = useRef<(() => void) | null>(null)

  const ask = useCallback((retry: () => void) => {
    retryRef.current = retry
    setOpen(true)
  }, [])

  const dialog = (
    <AdultConfirmDialog
      open={open}
      onCancel={() => {
        retryRef.current = null
        setOpen(false)
      }}
      onConfirmed={() => {
        const retry = retryRef.current
        retryRef.current = null
        setOpen(false)
        retry?.()
      }}
    />
  )

  return { ask, dialog }
}
