import { vi } from 'vitest'

// Мок для window.electronAPI для тестов

export const mockElectronAPI = {
  dbQuery: vi.fn(),
  dbExec: vi.fn(),
  dbBackup: vi.fn(),
  isElectron: true,
  platform: 'linux',
  onMenuAction: vi.fn(),
  getVersion: vi.fn(() => '1.0.0'),
  getAppVersion: vi.fn(() => '1.0.0')
}

export function setupElectronMock() {
  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true,
    configurable: true
  })
}

export function resetElectronMock() {
  Object.keys(mockElectronAPI).forEach(key => {
    if (typeof mockElectronAPI[key as keyof typeof mockElectronAPI] === 'function') {
      (mockElectronAPI[key as keyof typeof mockElectronAPI] as any).mockClear()
    }
  })
}
