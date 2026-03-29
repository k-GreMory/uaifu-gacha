import { useCallback, useEffect, useRef, useState } from 'react'

export function useToast(timeoutMs = 3000) {
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }

    setToast(message)
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, timeoutMs)
  }, [timeoutMs])

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  return {
    toast,
    showToast
  }
}
