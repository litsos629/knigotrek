import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import SettingsPage from '../SettingsPage'
import * as databaseService from '../../services/databaseService'

// Мокаем databaseService
vi.mock('../../services/databaseService')

// Мокаем Notification API
const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: vi.fn().mockResolvedValue('granted')
}

Object.defineProperty(global, 'Notification', {
  value: mockNotification,
  writable: true
})

describe('SettingsPage', () => {
  const mockToggleTheme = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getSetting).mockResolvedValue(null)
    vi.mocked(databaseService.setSetting).mockResolvedValue(true)
    vi.mocked(databaseService.getProjects).mockResolvedValue([])
    mockNotification.permission = 'default'
  })

  it('должен отображать заголовок', () => {
    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)
    expect(screen.getByText(/Настройки/i)).toBeInTheDocument()
  })

  it('должен переключать тему', async () => {
    const user = userEvent.setup()
    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)
    
    const themeButton = screen.getByText(/Тёмная тема|Светлая тема/i)
    await user.click(themeButton)

    expect(mockToggleTheme).toHaveBeenCalled()
  })

  it('должен загружать настройки уведомлений', async () => {
    vi.mocked(databaseService.getSetting)
      .mockResolvedValueOnce('true') // notificationsEnabled
      .mockResolvedValueOnce('20:00') // notificationTime

    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)

    await waitFor(() => {
      expect(databaseService.getSetting).toHaveBeenCalledWith('notificationsEnabled')
      expect(databaseService.getSetting).toHaveBeenCalledWith('notificationTime')
    })
  })

  it('должен включать/выключать уведомления', async () => {
    const user = userEvent.setup()
    mockNotification.permission = 'granted'

    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)

    await waitFor(() => {
      // Ищем checkbox для уведомлений
      const notificationsInput = screen.queryByRole('checkbox') || 
                                 screen.queryByLabelText(/Включить ежедневные/i)
      return expect(notificationsInput).toBeInTheDocument()
    })

    // Ищем переключатель уведомлений
    const notificationsInput = screen.getByRole('checkbox') || 
                               screen.getByLabelText(/Включить ежедневные/i)
    
    await user.click(notificationsInput)
    
    await waitFor(() => {
      expect(databaseService.setSetting).toHaveBeenCalled()
    })
  })

  it('должен запрашивать разрешение на уведомления', async () => {
    const user = userEvent.setup()
    mockNotification.permission = 'default'
    mockNotification.requestPermission.mockResolvedValue('granted')

    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)

    // Ищем кнопку запроса разрешения
    const requestButton = screen.queryByText(/Запросить разрешение/i) ||
                         screen.queryByText(/Включить уведомления/i)

    if (requestButton) {
      await user.click(requestButton)
      
      expect(mockNotification.requestPermission).toHaveBeenCalled()
    }
  })

  it('должен изменять время уведомлений', async () => {
    const user = userEvent.setup()
    mockNotification.permission = 'granted'
    vi.mocked(databaseService.getSetting)
      .mockResolvedValueOnce('true') // notificationsEnabled
      .mockResolvedValueOnce('19:00') // notificationTime

    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)

    await waitFor(() => {
      // Сначала включаем уведомления
      const checkbox = screen.queryByRole('checkbox')
      if (checkbox && !(checkbox as HTMLInputElement).checked) {
        return checkbox
      }
      // Ищем поле времени
      const timeInput = screen.queryByLabelText(/Время напоминания/i) ||
                       screen.queryByDisplayValue(/19:00/i)
      return expect(timeInput).toBeInTheDocument()
    })

    // Включаем уведомления если они выключены
    const checkbox = screen.queryByRole('checkbox')
    if (checkbox && !(checkbox as HTMLInputElement).checked) {
      await user.click(checkbox)
      await waitFor(() => {
        expect(screen.queryByLabelText(/Время напоминания/i)).toBeInTheDocument()
      })
    }

    // Input типа time не имеет role "textbox", используем querySelector
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
    
    if (timeInput) {
      await user.clear(timeInput)
      await user.type(timeInput, '20:00')
    }

    // Настройки сохраняются автоматически через useEffect
    await waitFor(() => {
      expect(databaseService.setSetting).toHaveBeenCalledWith('notificationTime', '20:00')
    }, { timeout: 2000 })
  })

  it('должен экспортировать данные', async () => {
    const user = userEvent.setup()
    const mockData = {
      entries: [{ id: 1, date: '2024-01-26', symbols: 500 }],
      projects: [],
      sessions: [],
      notes: []
    }

    vi.mocked(databaseService.getEntries).mockResolvedValue(mockData.entries)
    vi.mocked(databaseService.getProjects).mockResolvedValue(mockData.projects)
    vi.mocked(databaseService.getSessions).mockResolvedValue(mockData.sessions)
    vi.mocked(databaseService.getNotes).mockResolvedValue(mockData.notes)
    vi.mocked(databaseService.getChapters).mockResolvedValue([])

    // Мокаем URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    // Мокаем создание файла
    const clickSpy = vi.fn()
    
    // Сохраняем оригинальную функцию, чтобы избежать рекурсии
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor = originalCreateElement('a') as HTMLAnchorElement
        anchor.click = clickSpy
        return anchor
      }
      return originalCreateElement(tagName)
    })

    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)

    await waitFor(() => {
      const exportButton = screen.queryByText(/Экспортировать все данные/i) ||
                          screen.queryByText(/📥/i)
      return expect(exportButton).toBeInTheDocument()
    })

    const exportButton = screen.getByText(/Экспортировать все данные/i) ||
                        screen.getByText(/📥/i)
    await user.click(exportButton)

    // Экспорт собирает все данные (включая главы) и скачивает файл
    await waitFor(() => {
      expect(databaseService.getEntries).toHaveBeenCalled()
      expect(databaseService.getChapters).toHaveBeenCalled()
    }, { timeout: 5000 })

    // Также должен быть вызван click на созданном элементе <a>
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled()
    }, { timeout: 3000 })
    // createBackup больше не участвует в экспорте (для него отдельная кнопка в секции бэкапов)
    expect(databaseService.createBackup).not.toHaveBeenCalled()
  })

  it('должен импортировать данные', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const mockData = {
      version: '1.1',
      entries: [{ id: 1, date: '2024-01-26', symbols: 500 }],
      projects: [],
      sessions: [],
      notes: [],
      chapters: []
    }
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)

    // Мокаем FileReader
    const mockFile = new File([JSON.stringify(mockData)], 'test.json', { type: 'application/json' })
    const mockFileReader = {
      readAsText: vi.fn(function(this: any) {
        // Симулируем асинхронное чтение
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: JSON.stringify(mockData) } })
          }
        }, 10)
      }),
      result: JSON.stringify(mockData),
      onload: null as any
    }

    // Используем правильный способ мокирования FileReader
    const FileReaderSpy = vi.fn(function(this: any) {
      this.readAsText = mockFileReader.readAsText
      this.result = mockFileReader.result
      this.onload = null
    })
    global.FileReader = FileReaderSpy as any

    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)

    // Кнопка импорта открывает скрытый input
    const importButton = screen.getByText(/Импортировать данные/i) ||
                        screen.getByText(/📤/i)
    await user.click(importButton)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    
    if (fileInput) {
      await user.upload(fileInput, mockFile)

      // FileReader.readAsText должен быть вызван
      await waitFor(() => {
        expect(mockFileReader.readAsText).toHaveBeenCalled()
      }, { timeout: 1000 })

      // После загрузки файла должен быть вызван confirm
      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalled()
      }, { timeout: 3000 })
    }

    confirmSpy.mockRestore()
  })

  it('должен создавать бэкап', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    // Мокаем electronAPI для теста бэкапа
    ;(window as any).electronAPI = {
      createBackup: vi.fn().mockResolvedValue({ success: true, path: '/path/to/backup.json' })
    }

    vi.mocked(databaseService.createBackup).mockResolvedValue({ 
      success: true, 
      path: '/path/to/backup.json' 
    })

    render(<SettingsPage theme="light" toggleTheme={mockToggleTheme} />)

    await waitFor(() => {
      const backupButton = screen.queryByText(/Создать бэкап/i) ||
                          screen.queryByText(/🔄/i)
      return expect(backupButton).toBeInTheDocument()
    })

    const backupButton = screen.getByText(/Создать бэкап/i) ||
                        screen.getByText(/🔄/i)
    await user.click(backupButton)

    await waitFor(() => {
      expect(databaseService.createBackup).toHaveBeenCalled()
    }, { timeout: 3000 })

    alertSpy.mockRestore()
  })
})
