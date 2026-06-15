import { render, type RenderOptions } from '@testing-library/react'
import { ToastProvider } from '../components/Toast'
import { TestConfirmProvider } from '../components/ConfirmModal'
import type { ReactElement } from 'react'

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TestConfirmProvider>
        {children}
      </TestConfirmProvider>
    </ToastProvider>
  )
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react'
export { customRender as render }
