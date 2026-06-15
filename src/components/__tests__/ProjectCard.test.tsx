import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import ProjectCard from '../ProjectCard'
import * as databaseService from '../../services/databaseService'
import type { Project } from '../../services/databaseService'

// Мокаем databaseService
vi.mock('../../services/databaseService')
vi.mock('date-fns', () => ({
  format: (date: Date, format: string) => {
    if (format === 'd MMM yyyy') return '26 янв 2024'
    return date.toISOString()
  },
  differenceInDays: (a: Date, b: Date) => {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
  },
  subDays: (date: Date, days: number) => {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
  },
  ru: {}
}))

describe('ProjectCard', () => {
  const mockProject: Project = {
    id: 'p1',
    title: 'Тестовый проект',
    genre: 'Фэнтези',
    targetSymbols: 100000,
    deadline: '2024-12-31',
    status: 'active',
    startDate: '2024-01-01'
  }

  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
    vi.mocked(databaseService.getChapters).mockResolvedValue([])
  })

  it('должен отображать название проекта', async () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Тестовый проект')).toBeInTheDocument()
    })
  })

  it('должен показывать прогресс проекта', async () => {
    vi.mocked(databaseService.getEntries).mockResolvedValue([
      { id: 1, date: '2024-01-26', symbols: 50000, projectId: 'p1' }
    ])

    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/50%/i)).toBeInTheDocument()
    })
  })

  it('должен вызывать onEdit при редактировании', async () => {
    const user = userEvent.setup()

    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Тестовый проект')).toBeInTheDocument()
    })

    const editButton = screen.getByText(/Редактировать/i)
    await user.click(editButton)

    expect(mockOnEdit).toHaveBeenCalledWith(mockProject)
  })

  it('должен вызывать onDelete при удалении', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Тестовый проект')).toBeInTheDocument()
    })

    const deleteButton = screen.getByText(/Удалить/i)
    await user.click(deleteButton)

    expect(confirmSpy).toHaveBeenCalled()
    expect(mockOnDelete).toHaveBeenCalledWith('p1')

    confirmSpy.mockRestore()
  })

  it('должен вызывать onComplete при завершении', async () => {
    const user = userEvent.setup()
    
    // Кнопка завершения показывается только при прогрессе >= 80%
    vi.mocked(databaseService.getEntries).mockResolvedValue([
      { id: 1, date: '2024-01-26', symbols: 80000, projectId: 'p1' } // 80% прогресс
    ])

    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
      />
    )

    await waitFor(() => {
      const completeButton = screen.queryByText(/Завершить/i)
      return expect(completeButton).toBeInTheDocument()
    }, { timeout: 3000 })

    const completeButton = screen.getByText(/Завершить/i)
    await user.click(completeButton)

    expect(mockOnComplete).toHaveBeenCalledWith('p1')
  })

  it('должен показывать дедлайн', async () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Дедлайн/i)).toBeInTheDocument()
    })
  })

  it('должен показывать жанр проекта', async () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Фэнтези')).toBeInTheDocument()
    })
  })

  it('при отставании предлагает перенос дедлайна и вызывает onReplan', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const mockOnReplan = vi.fn()

    // близкий дедлайн + малый темп → сильное отставание (status: 'behind')
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]
    vi.mocked(databaseService.getEntries).mockResolvedValue([
      { id: 1, date: todayStr, symbols: 1000, projectId: 'p1' }
    ])

    render(
      <ProjectCard
        project={{ ...mockProject, deadline: soon }}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onComplete={mockOnComplete}
        onReplan={mockOnReplan}
      />
    )

    const replanBtn = await screen.findByText(/Перенести дедлайн/i)
    await user.click(replanBtn)

    expect(confirmSpy).toHaveBeenCalled()
    expect(mockOnReplan).toHaveBeenCalled()
    expect(mockOnReplan.mock.calls[0][0].id).toBe('p1')

    confirmSpy.mockRestore()
  })
})
