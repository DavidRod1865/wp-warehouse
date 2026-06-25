import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

type ToastVariant = 'success' | 'error'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 items-center">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))

    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, 4000)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.id, onDismiss])

  const isSuccess = toast.variant === 'success'

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-base font-semibold text-white transition-all duration-300 ${
        isSuccess ? 'bg-green-600' : 'bg-red-600'
      }`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-16px) scale(0.95)',
        boxShadow: visible
          ? `0 12px 40px -8px ${isSuccess ? 'rgba(22,163,74,.45)' : 'rgba(220,38,38,.45)'}`
          : 'none',
      }}
    >
      <Icon
        name={isSuccess ? 'check' : 'alert'}
        className="w-5 h-5 shrink-0"
      />
      <span>{toast.message}</span>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(() => onDismiss(toast.id), 300)
        }}
        className="ml-1 p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/15"
      >
        <Icon name="close" className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
