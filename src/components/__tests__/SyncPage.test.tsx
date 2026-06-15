import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import SyncPage from '../SyncPage'
import * as databaseService from '../../services/databaseService'

// Мокаем databaseService
vi.mock('../../services/databaseService')

// Мокаем cloudSyncService
vi.mock('../../services/cloudSyncService', () => ({
  isConfigured: vi.fn(() => false),
  getCurrentUser: vi.fn(() => Promise.resolve(null)),
  signInWithSyncKey: vi.fn(),
  signInWithEmail: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  generateSyncKey: vi.fn(() => 'test-uuid'),
  getSavedSyncKey: vi.fn(() => null),
  getSyncMethod: vi.fn(() => null),
  syncAll: vi.fn(),
  getLastSyncTime: vi.fn(() => null),
}))

function mockEmptyData() {
  vi.mocked(databaseService.getEntries).mockResolvedValue([])
  vi.mocked(databaseService.getProjects).mockResolvedValue([])
  vi.mocked(databaseService.getSessions).mockResolvedValue([])
  vi.mocked(databaseService.getNotes).mockResolvedValue([])
  vi.mocked(databaseService.getChapters).mockResolvedValue([])
}

describe('SyncPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('должен отображать заголовок', async () => {
    mockEmptyData()

    render(<SyncPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Данные и синхронизация/i)
    })
  })

  it('не должен упоминать QR-код и синхронизацию с телефоном', async () => {
    mockEmptyData()

    render(<SyncPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })
    expect(screen.queryByText(/QR/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/телефон/i)).not.toBeInTheDocument()
  })

  it('должен скачивать файл экспорта по кнопке', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.getEntries).mockResolvedValue([{ id: 1, date: '2024-01-26', symbols: 500 }])
    vi.mocked(databaseService.getProjects).mockResolvedValue([])
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
    vi.mocked(databaseService.getNotes).mockResolvedValue([])
    vi.mocked(databaseService.getChapters).mockResolvedValue([])

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor = originalCreateElement('a') as HTMLAnchorElement
        anchor.click = clickSpy
        return anchor
      }
      return originalCreateElement(tagName)
    })

    render(<SyncPage />)

    const downloadButton = await screen.findByText(/Экспортировать файл/i)
    await user.click(downloadButton)

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled()
    }, { timeout: 3000 })
    expect(databaseService.getEntries).toHaveBeenCalled()
    expect(databaseService.getChapters).toHaveBeenCalled()
  })

  it('должен импортировать данные из файла через подтверждение', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const fileData = {
      version: '1.1',
      entries: [{ id: 7, date: '2024-01-26', symbols: 500 }],
      projects: [{ id: 'p1', title: 'Тест', genre: 'fantasy', targetSymbols: 1000, deadline: '2024-12-31', status: 'active', startDate: '2024-01-01' }],
      sessions: [],
      notes: [],
      chapters: []
    }

    mockEmptyData()
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)
    vi.mocked(databaseService.saveProject).mockResolvedValue(true)

    const mockFile = new File([JSON.stringify(fileData)], 'test.json', { type: 'application/json' })
    const originalText = File.prototype.text
    File.prototype.text = vi.fn().mockResolvedValue(JSON.stringify(fileData))

    render(<SyncPage />)

    const fileInput = await waitFor(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input).toBeInTheDocument()
      return input
    })

    await user.upload(fileInput, mockFile)

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
      expect(databaseService.saveProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
      // запись импортируется без числового id (id автоинкрементны и различаются между устройствами)
      expect(databaseService.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ date: '2024-01-26', symbols: 500 }))
      expect(vi.mocked(databaseService.saveEntry).mock.calls[0][0].id).toBeUndefined()
    }, { timeout: 3000 })

    File.prototype.text = originalText
    confirmSpy.mockRestore()
  })

  it('должен показывать ошибку при неверном формате файла', async () => {
    const user = userEvent.setup()
    mockEmptyData()

    const mockFile = new File(['не json'], 'test.json', { type: 'application/json' })
    const originalText = File.prototype.text
    File.prototype.text = vi.fn().mockResolvedValue('не json')

    render(<SyncPage />)

    const fileInput = await waitFor(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input).toBeInTheDocument()
      return input
    })

    await user.upload(fileInput, mockFile)

    await waitFor(() => {
      expect(screen.getByText(/Unexpected token|ошибк|Невер/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    File.prototype.text = originalText
  })
})
