import { useEffect } from 'react'

let lockCount = 0

export function useModalScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    if (lockCount === 0) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    }
    lockCount++

    return () => {
      lockCount--
      if (lockCount <= 0) {
        lockCount = 0
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])
}
