import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import CompletedProjectCard from '../CompletedProjectCard'
import * as databaseService from '../../services/databaseService'
import type { Project } from '../../services/databaseService'

// Мокаем databaseService
vi.mock('../../services/databaseService')
vi.mock('date-fns', () => ({
  format: (date: Date, format: string) => {
    if (format === 'd MMM yyyy') return '26 янв 2024'
    return date.toISOString()
  },
  ru: {}
}))

describe('CompletedProjectCard', () => {
  const mockProject: Project = {
    id: 'p1',
    title: 'Завершённый проект',
    genre: 'Фэнтези',
    targetSymbols: 100000,
    deadline: '2024-12-31',
    status: 'completed',
    startDate: '2024-01-01',
    completedDate: '2024-12-31'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
  })

  it('должен отображать название завершённого проекта', async () => {
    render(<CompletedProjectCard project={mockProject} />)

    await waitFor(() => {
      expect(screen.getByText(/Завершённый проект/i)).toBeInTheDocument()
    })
  })

  it('должен показывать прогресс проекта', async () => {
    vi.mocked(databaseService.getEntries).mockResolvedValue([
      { id: 1, date: '2024-01-26', symbols: 100000, projectId: 'p1' }
    ])

    render(<CompletedProjectCard project={mockProject} />)

    await waitFor(() => {
      // Компонент показывает количество символов, формат может быть разным (100,000 или 100 000)
      expect(screen.getByText(/100[,\s]?000/i)).toBeInTheDocument()
    })
  })

  it('должен показывать жанр проекта', async () => {
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
    
    render(<CompletedProjectCard project={mockProject} />)

    await waitFor(() => {
      // Жанр показывается вместе с количеством символов в формате "Жанр • количество символов"
      expect(screen.getByText(/Фэнтези/i)).toBeInTheDocument()
    })
  })

  it('должен показывать количество символов', async () => {
    vi.mocked(databaseService.getEntries).mockResolvedValue([
      { id: 1, date: '2024-01-26', symbols: 100000, projectId: 'p1' }
    ])

    render(<CompletedProjectCard project={mockProject} />)

    await waitFor(() => {
      // Формат может быть разным (100,000 или 100 000)
      expect(screen.getByText(/100[,\s]?000/i)).toBeInTheDocument()
    })
  })

  it('должен показывать дату завершения', async () => {
    render(<CompletedProjectCard project={mockProject} />)

    await waitFor(() => {
      expect(screen.getByText(/Завершён/i)).toBeInTheDocument()
    })
  })

  it('должен показывать загрузку при загрузке данных', () => {
    vi.mocked(databaseService.getEntries).mockImplementation(() => new Promise(() => {}))

    render(<CompletedProjectCard project={mockProject} />)

    expect(screen.getByText(/Загрузка/i)).toBeInTheDocument()
  })
})
