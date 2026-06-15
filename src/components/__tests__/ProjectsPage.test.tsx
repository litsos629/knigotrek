import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import ProjectsPage from '../ProjectsPage'
import * as databaseService from '../../services/databaseService'
import type { Project } from '../../services/databaseService'

// Мокаем databaseService
vi.mock('../../services/databaseService')

// Мокаем импорты date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, format: string, _options?: any) => {
    if (format === 'd MMM yyyy') return '26 янв 2024'
    if (format === 'd MMMM yyyy') return '26 января 2024'
    return date.toISOString()
  },
  differenceInDays: (a: Date, b: Date) => {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
  },
  subDays: (date: Date, days: number) => {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
  },
  addDays: (date: Date, days: number) => {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
  },
  ru: {}
}))

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Используем vi.mocked для правильной работы с моками
    vi.mocked(databaseService.getProjects).mockResolvedValue([])
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
  })

  it('должен отображать заголовок', async () => {
    render(<ProjectsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Проекты/i)).toBeInTheDocument()
    })
  })

  it('должен показывать кнопку создания проекта', async () => {
    render(<ProjectsPage />)
    
    await waitFor(() => {
      // Ищем кнопку в заголовке (более специфично)
      const buttons = screen.getAllByText(/Создать проект/i)
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  it('должен открывать форму создания проекта', async () => {
    const user = userEvent.setup()
    render(<ProjectsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Проекты/i)).toBeInTheDocument()
    })

    // Ищем кнопку в заголовке (первая кнопка с текстом "Создать проект")
    const createButtons = screen.getAllByText(/Создать проект/i)
    const headerButton = createButtons.find(btn => 
      btn.textContent?.includes('+ Создать проект') || 
      btn.closest('button')?.className.includes('bg-indigo-600')
    ) || createButtons[0]
    
    await user.click(headerButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Например: Моя первая книга/i)).toBeInTheDocument()
    })
  })

  it('должен валидировать форму создания проекта', async () => {
    const user = userEvent.setup()

    render(<ProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Проекты/i)).toBeInTheDocument()
    })

    const createButtons = screen.getAllByText(/Создать проект/i)
    const headerButton = createButtons.find(btn =>
      btn.textContent?.includes('+ Создать проект') ||
      btn.closest('button')?.className.includes('bg-indigo-600')
    ) || createButtons[0]

    await user.click(headerButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Например: Моя первая книга/i)).toBeInTheDocument()
    })

    const saveButton = screen.getByText('Создать')
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Введи название проекта')).toBeInTheDocument()
    })
  })

  it('должен создавать проект с валидными данными', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveProject).mockResolvedValue(true)
    vi.mocked(databaseService.getProjects)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
      {
        id: '1',
        title: 'Новый проект',
        genre: 'Фэнтези',
        targetSymbols: 100000,
        deadline: '2024-12-31',
        status: 'active',
        startDate: '2024-01-01'
      }
    ])

    render(<ProjectsPage />)
    
    // Используем getAllByText, так как может быть несколько кнопок "Создать проект"
    const createButtons = screen.getAllByText(/Создать проект/i)
    await user.click(createButtons[0]) // Кликаем на первую кнопку

    const titleInput = screen.getByPlaceholderText(/Например: Моя первая книга/i)
    // Input типа date не имеет role "textbox", используем querySelector
    const deadlineInput = document.querySelector('input[type="date"]') as HTMLInputElement
    
    await user.type(titleInput, 'Новый проект')
    
    // Устанавливаем дедлайн
    if (deadlineInput) {
      await user.clear(deadlineInput)
      await user.type(deadlineInput, '2024-12-31')
    }

    const saveButton = screen.getByText('Создать')
    await user.click(saveButton)

    await waitFor(() => {
      expect(databaseService.saveProject).toHaveBeenCalled()
    })
  })

  it('должен удалять проект', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(databaseService.deleteProject).mockResolvedValue(true)

    const project: Project = {
      id: '1',
      title: 'Тестовый проект',
      genre: 'Фэнтези',
      targetSymbols: 100000,
      deadline: '2024-12-31',
      status: 'active',
      startDate: '2024-01-01'
    }

    vi.mocked(databaseService.getProjects).mockResolvedValue([project])

    render(<ProjectsPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Тестовый проект')).toBeInTheDocument()
    })

    const deleteButton = screen.getByText('Удалить')
    await user.click(deleteButton)

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(databaseService.deleteProject).toHaveBeenCalledWith('1')
    })

    confirmSpy.mockRestore()
  })

  it('должен показывать завершённые проекты', async () => {
    const completedProject: Project = {
      id: '1',
      title: 'Завершённый проект',
      genre: 'Фэнтези',
      targetSymbols: 100000,
      deadline: '2024-12-31',
      status: 'completed',
      startDate: '2024-01-01',
      completedDate: '2024-01-26'
    }

    vi.mocked(databaseService.getProjects).mockResolvedValue([completedProject])
    // CompletedProjectCard загружает данные асинхронно
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(<ProjectsPage />)

    await waitFor(() => {
      // CompletedProjectCard показывает "✅ Завершённый проект"
      expect(screen.getByText(/Завершённый проект/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('должен показывать приостановленные проекты', async () => {
    const pausedProject: Project = {
      id: '1',
      title: 'Приостановленный проект',
      genre: 'Фэнтези',
      targetSymbols: 100000,
      deadline: '2024-12-31',
      status: 'paused',
      startDate: '2024-01-01'
    }

    vi.mocked(databaseService.getProjects).mockResolvedValue([pausedProject])
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(<ProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Приостановленные проекты/i)).toBeInTheDocument()
      expect(screen.getByText(/Приостановленный проект/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('должен разморозить проект при свободном слоте', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(databaseService.saveProject).mockResolvedValue(true)

    const completedProject: Project = {
      id: '1',
      title: 'Завершённый проект',
      genre: 'Фэнтези',
      targetSymbols: 100000,
      deadline: '2024-12-31',
      status: 'completed',
      startDate: '2024-01-01',
      completedDate: '2024-06-15',
      unfreezeCount: 0
    }

    vi.mocked(databaseService.getProjects).mockResolvedValue([completedProject])
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(<ProjectsPage />)

    // Ждём загрузки CompletedProjectCard
    await waitFor(() => {
      expect(screen.getByText(/Завершённый проект/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Кликаем на меню (⋯)
    const menuButton = screen.getByLabelText('Меню')
    await userEvent.click(menuButton)

    // Кликаем "Возобновить проект"
    const unfreezeButton = await screen.findByText(/Возобновить проект/i)
    await userEvent.click(unfreezeButton)

    // Должен показаться confirm (message содержит название проекта)
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Завершённый проект'))

    // Должен сохранить проект с status='active' и unfreezeCount=1
    await waitFor(() => {
      expect(databaseService.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          status: 'active',
          unfreezeCount: 1
        })
      )
    })

    confirmSpy.mockRestore()
  })
})
