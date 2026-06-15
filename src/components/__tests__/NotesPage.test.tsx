import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import NotesPage from '../NotesPage'
import * as databaseService from '../../services/databaseService'

// Мокаем databaseService
vi.mock('../../services/databaseService')
vi.mock('date-fns', () => ({
  format: (date: Date, format: string) => {
    if (format === 'd MMM yyyy') return '26 янв 2024'
    return date.toISOString()
  },
  ru: {}
}))

describe('NotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getNotes).mockResolvedValue([])
  })

  it('должен отображать заголовок', async () => {
    render(<NotesPage />)
    
    await waitFor(() => {
      // Используем getAllByText, так как "Заметки" может встречаться несколько раз
      const notesTexts = screen.queryAllByText(/Заметки/i)
      expect(notesTexts.length).toBeGreaterThan(0)
    })
  })

  it('должен показывать кнопку создания заметки', () => {
    render(<NotesPage />)
    expect(screen.getByText(/Создать заметку/i)).toBeInTheDocument()
  })

  it('должен создавать новую заметку', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveNote).mockResolvedValue(true)
    vi.mocked(databaseService.getNotes).mockResolvedValue([
      {
        id: '1',
        title: 'Новая заметка',
        content: '',
        date: new Date().toISOString()
      }
    ])

    render(<NotesPage />)
    
    const createButton = screen.getByText(/Создать заметку/i)
    await user.click(createButton)

    await waitFor(() => {
      expect(databaseService.saveNote).toHaveBeenCalled()
    })
  })

  it('должен загружать и отображать заметки', async () => {
    const notes = [
      {
        id: '1',
        title: 'Тестовая заметка',
        content: 'Содержимое заметки',
        date: new Date().toISOString()
      },
      {
        id: '2',
        title: 'Вторая заметка',
        content: 'Ещё содержимое',
        date: new Date().toISOString()
      }
    ]

    vi.mocked(databaseService.getNotes).mockResolvedValue(notes)

    render(<NotesPage />)

    await waitFor(() => {
      expect(screen.getByText('Тестовая заметка')).toBeInTheDocument()
      expect(screen.getByText('Вторая заметка')).toBeInTheDocument()
    })
  })

  it('должен открывать заметку для редактирования', async () => {
    const user = userEvent.setup()
    const note = {
      id: '1',
      title: 'Тестовая заметка',
      content: 'Содержимое',
      date: new Date().toISOString()
    }

    vi.mocked(databaseService.getNotes).mockResolvedValue([note])

    render(<NotesPage />)

    await waitFor(() => {
      expect(screen.getByText('Тестовая заметка')).toBeInTheDocument()
    })

    // Кликаем на заметку в списке (ищем в списке заметок)
    const noteElement = screen.getByText('Тестовая заметка')
    await user.click(noteElement)

    // Ждём появления просмотра заметки (не формы редактирования сразу)
    await waitFor(() => {
      // Проверяем что появилась кнопка "Редактировать"
      const editButton = screen.queryByText(/Редактировать/i)
      expect(editButton).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('должен сохранять изменения заметки', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveNote).mockResolvedValue(true)
    
    const note = {
      id: '1',
      title: 'Тестовая заметка',
      content: 'Содержимое',
      date: new Date().toISOString()
    }

    vi.mocked(databaseService.getNotes)
      .mockResolvedValueOnce([note])
      .mockResolvedValueOnce([{ ...note, title: 'Обновлённая заметка' }])

    render(<NotesPage />)

    await waitFor(() => {
      expect(screen.getByText('Тестовая заметка')).toBeInTheDocument()
    })

    const noteElement = screen.getByText('Тестовая заметка')
    await user.click(noteElement)

    // Ждём появления просмотра заметки, затем открываем редактирование
    await waitFor(() => {
      const editButton = screen.queryByText(/Редактировать/i)
      return expect(editButton).toBeInTheDocument()
    }, { timeout: 3000 })

    // Открываем режим редактирования
    const editButton = screen.getByText(/Редактировать/i)
    await user.click(editButton)

    // Ждём появления формы редактирования
    await waitFor(() => {
      const titleInput = screen.queryByDisplayValue('Тестовая заметка') ||
                        screen.queryByPlaceholderText(/Название/i)
      return expect(titleInput).toBeInTheDocument()
    }, { timeout: 3000 })

    const titleInput = screen.getByDisplayValue('Тестовая заметка') ||
                      screen.getByPlaceholderText(/Название/i)
    
    await user.clear(titleInput)
    await user.type(titleInput, 'Обновлённая заметка')

    const saveButton = screen.getByText(/Сохранить/i)
    await user.click(saveButton)

    await waitFor(() => {
      expect(databaseService.saveNote).toHaveBeenCalled()
    })
  })

  it('должен удалять заметку', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(databaseService.deleteNote).mockResolvedValue(true)

    const note = {
      id: '1',
      title: 'Тестовая заметка',
      content: 'Содержимое',
      date: new Date().toISOString()
    }

    vi.mocked(databaseService.getNotes)
      .mockResolvedValueOnce([note])
      .mockResolvedValueOnce([])

    render(<NotesPage />)

    await waitFor(() => {
      expect(screen.getByText('Тестовая заметка')).toBeInTheDocument()
    })

    // Открываем заметку для редактирования, чтобы появилась кнопка удаления
    const noteElement = screen.getByText('Тестовая заметка')
    await user.click(noteElement)

    await waitFor(() => {
      const deleteButton = screen.queryByText(/Удалить/i)
      return expect(deleteButton).toBeInTheDocument()
    }, { timeout: 3000 })

    const deleteButton = screen.getByText(/Удалить/i)
    await user.click(deleteButton)

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(databaseService.deleteNote).toHaveBeenCalledWith('1')
    })

    confirmSpy.mockRestore()
  })

  it('не должен удалять заметку без подтверждения', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const note = {
      id: '1',
      title: 'Тестовая заметка',
      content: 'Содержимое',
      date: new Date().toISOString()
    }

    vi.mocked(databaseService.getNotes).mockResolvedValue([note])

    render(<NotesPage />)

    await waitFor(() => {
      expect(screen.getByText('Тестовая заметка')).toBeInTheDocument()
    })

    // Открываем заметку
    const noteElement = screen.getByText('Тестовая заметка')
    await user.click(noteElement)

    await waitFor(() => {
      const deleteButton = screen.queryByText(/Удалить/i)
      return expect(deleteButton).toBeInTheDocument()
    }, { timeout: 3000 })

    const deleteButton = screen.getByText(/Удалить/i)
    await user.click(deleteButton)

    expect(confirmSpy).toHaveBeenCalled()
    expect(databaseService.deleteNote).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })
})
