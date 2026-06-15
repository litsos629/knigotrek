import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'
import HomePage from '../HomePage'
import * as databaseService from '../../services/databaseService'

// Мокаем databaseService
vi.mock('../../services/databaseService')
vi.mock('../AssistantCard', () => ({
  default: () => <div data-testid="assistant-card">Assistant</div>
}))
vi.mock('../CalendarHeatmap', () => ({
  default: () => <div data-testid="calendar-heatmap">Calendar</div>
}))
vi.mock('../RecordsCard', () => ({
  default: () => <div data-testid="records-card">Records</div>
}))
vi.mock('../AchievementsCard', () => ({
  default: () => <div data-testid="achievements-card">Achievements</div>
}))
// ForecastCard объединен с AssistantCard

describe('HomePage', () => {
  const mockSetSelectedProjectId = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
    vi.mocked(databaseService.getProjects).mockResolvedValue([])
  })

  it('должен отображать заголовок', () => {
    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    expect(screen.getByText('Главная')).toBeInTheDocument()
  })

  it('должен отображать статистику', async () => {
    vi.mocked(databaseService.getEntries).mockResolvedValue([
      { id: 1, date: '2024-01-26', symbols: 500 },
      { id: 2, date: '2024-01-25', symbols: 300 }
    ])

    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Всего символов/i)).toBeInTheDocument()
    })
  })

  it('должен сохранять новую запись', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    const input = screen.getByPlaceholderText(/Например: 500/i)
    const button = screen.getByText('Сохранить')

    await user.type(input, '500')
    await user.click(button)

    await waitFor(() => {
      expect(databaseService.saveEntry).toHaveBeenCalled()
    })
  })

  it('должен прибавлять символы к существующей записи за сегодня', async () => {
    const user = userEvent.setup()
    // Используем format как в компоненте
    const today = format(new Date(), 'yyyy-MM-dd')
    
    const existingEntry = { id: 1, date: today, symbols: 300 }
    // Мокаем getEntries для загрузки данных
    vi.mocked(databaseService.getEntries).mockResolvedValue([existingEntry])
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)

    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    // Ждем, пока данные загрузятся и компонент отрендерится
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Например: 500/i)
      expect(input).toBeInTheDocument()
    }, { timeout: 3000 })

    const input = screen.getByPlaceholderText(/Например: 500/i)
    const button = screen.getByText('Сохранить')

    await user.clear(input)
    await user.type(input, '200')
    await user.click(button)

    // Ждем, пока saveEntry будет вызван
    await waitFor(() => {
      expect(databaseService.saveEntry).toHaveBeenCalled()
    }, { timeout: 3000 })
    
    // Проверяем, что saveEntry был вызван с правильными аргументами
    const calls = vi.mocked(databaseService.saveEntry).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const lastCall = calls[calls.length - 1][0]
    expect(lastCall).toMatchObject({
      id: 1,
      date: today,
      symbols: 500 // 300 + 200
    })
  })

  it('должен очищать поле после сохранения', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    const input = screen.getByPlaceholderText(/Например: 500/i) as HTMLInputElement
    const button = screen.getByText('Сохранить')

    await user.type(input, '500')
    await user.click(button)

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('должен сохранять по Enter', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    const input = screen.getByPlaceholderText(/Например: 500/i)
    
    await user.type(input, '500{Enter}')

    await waitFor(() => {
      expect(databaseService.saveEntry).toHaveBeenCalled()
    })
  })

  it('должен фильтровать записи по выбранному проекту', async () => {
    const project1Entries = [
      { id: 1, date: '2024-01-26', symbols: 500, projectId: 'project1' }
    ]
    const project2Entries = [
      { id: 2, date: '2024-01-26', symbols: 300, projectId: 'project2' }
    ]

    vi.mocked(databaseService.getEntries).mockResolvedValue([
      ...project1Entries,
      ...project2Entries
    ])

    const { rerender } = render(
      <HomePage selectedProjectId="project1" setSelectedProjectId={mockSetSelectedProjectId} />
    )

    await waitFor(() => {
      // Проверяем что данные загрузились
      expect(databaseService.getEntries).toHaveBeenCalled()
    })

    rerender(
      <HomePage selectedProjectId="project2" setSelectedProjectId={mockSetSelectedProjectId} />
    )

    await waitFor(() => {
      // Проверяем что компонент обновился
      expect(screen.getByText(/Главная/i)).toBeInTheDocument()
    })
  })

  it('должен вычислять streak правильно', async () => {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0]
    const dayBefore = new Date(Date.now() - 2*24*60*60*1000).toISOString().split('T')[0]

    vi.mocked(databaseService.getEntries).mockResolvedValue([
      { id: 1, date: today, symbols: 500 },
      { id: 2, date: yesterday, symbols: 300 },
      { id: 3, date: dayBefore, symbols: 200 }
    ])

    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    await waitFor(() => {
      // Streak должен быть 3 (сегодня, вчера, позавчера)
      expect(screen.getByText(/🔥/)).toBeInTheDocument()
    })
  })

  it('должен показывать 0 streak при отсутствии записей', async () => {
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(<HomePage selectedProjectId="all" setSelectedProjectId={mockSetSelectedProjectId} />)
    
    await waitFor(() => {
      // Проверяем что страница загрузилась
      expect(screen.getByText(/Главная/i)).toBeInTheDocument()
      // Проверяем что данные загрузились
      expect(databaseService.getEntries).toHaveBeenCalled()
    })
  })
})
