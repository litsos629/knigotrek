import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ========== ТИПЫ ==========

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastAction {
  label: string
  onAction: () => void
}

interface Toast {
  id: number
  message: string
  type: ToastType
  duration: number
  action?: ToastAction
}

interface ToastOptions {
  duration?: number
  action?: ToastAction
}

interface ToastContextType {
  /** Третий аргумент — длительность (мс) или опции с кнопкой действия (undo). */
  showToast: (message: string, type?: ToastType, durationOrOptions?: number | ToastOptions) => void
}

// ========== КОНТЕКСТ ==========

const ToastContext = createContext<ToastContextType | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info', durationOrOptions: number | ToastOptions = 3000) => {
    const id = ++nextId
    const options: ToastOptions = typeof durationOrOptions === 'number' ? { duration: durationOrOptions } : durationOrOptions
    // С кнопкой действия держим тост дольше — пользователю нужно успеть нажать
    const duration = options.duration ?? (options.action ? 7000 : 3000)
    setToasts(prev => [...prev, { id, message, type, duration, action: options.action }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Контейнер уведомлений */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ========== КОМПОНЕНТ TOAST ==========

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const colors: Record<ToastType, string> = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-indigo-600 text-white',
    warning: 'bg-amber-500 text-white'
  }

  const icons: Record<ToastType, string> = {
    success: '\u2705',
    error: '\u274C',
    info: '\u2139\uFE0F',
    warning: '\u26A0\uFE0F'
  }

  return (
    <div
      className={`${colors[toast.type]} px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      }`}
      style={{ animation: isExiting ? undefined : 'slideIn 0.3s ease-out' }}
    >
      <span>{icons[toast.type]}</span>
      <span className="text-sm flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onAction()
            setIsExiting(true)
            setTimeout(() => onRemove(toast.id), 300)
          }}
          className="ml-1 px-2 py-1 text-sm font-bold underline underline-offset-2 hover:opacity-80 transition"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => {
          setIsExiting(true)
          setTimeout(() => onRemove(toast.id), 300)
        }}
        className="ml-2 opacity-70 hover:opacity-100 transition"
      >
        &times;
      </button>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(1rem); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// ========== ХУКИ ==========

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
