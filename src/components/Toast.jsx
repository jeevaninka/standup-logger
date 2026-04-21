/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ToastContext = createContext(null)

const VARIANT_STYLES = {
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200 ring-emerald-200/80',
  error: 'bg-red-50 text-red-900 border-red-200 ring-red-200/80',
  warning: 'bg-amber-50 text-amber-950 border-amber-200 ring-amber-200/80',
}

function ToastBanner({ message, variant }) {
  const cls = VARIANT_STYLES[variant] ?? VARIANT_STYLES.success
  return (
    <div
      className={`fixed bottom-4 right-4 z-[100] max-w-sm rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ring-1 ${cls}`}
      role="status"
    >
      {message}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? <ToastBanner key={toast.id} message={toast.message} variant={toast.variant} /> : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx.showToast
}
