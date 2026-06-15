import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// ========== ТИПЫ ==========

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

// ========== КОНТЕКСТ ==========

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts)
      setResolver(() => resolve)
    })
  }, [])

  const handleConfirm = () => {
    resolver?.(true)
    setOptions(null)
    setResolver(null)
  }

  const handleCancel = () => {
    resolver?.(false)
    setOptions(null)
    setResolver(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
              {options.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 whitespace-pre-line">
              {options.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {options.cancelText || t('modals:confirm.defaultCancel')}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg transition font-medium text-white ${
                  options.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : options.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {options.confirmText || t('modals:confirm.defaultConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// ========== ХУКИ ==========

export function useConfirm(): ConfirmContextType {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return ctx
}

// ========== TEST HELPER ==========

/**
 * Тестовый провайдер — делегирует confirm в window.confirm.
 * Позволяет тестам использовать vi.spyOn(window, 'confirm').
 */
export function TestConfirmProvider({ children }: { children: ReactNode }) {
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return Promise.resolve(window.confirm(options.message))
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
    </ConfirmContext.Provider>
  )
}
