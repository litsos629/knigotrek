import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import ReportGenerator from '../ReportGenerator'
import * as databaseService from '../../services/databaseService'

vi.mock('../../services/databaseService')
vi.mock('../../services/reports/index', () => ({
  generateDailyReport: vi.fn().mockResolvedValue({ output: vi.fn(() => new Blob()), save: vi.fn() }),
  generateWeeklyReport: vi.fn().mockResolvedValue({ output: vi.fn(() => new Blob()), save: vi.fn() }),
  generateMonthlyReport: vi.fn().mockResolvedValue({ output: vi.fn(() => new Blob()), save: vi.fn() }),
  generateProjectReport: vi.fn().mockResolvedValue({ output: vi.fn(() => new Blob()), save: vi.fn() }),
}))
vi.mock('jspdf', () => {
  const MockJsPDF = vi.fn(() => ({
    save: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn()
  }))
  ;(MockJsPDF as any).API = { events: [] }
  return { default: MockJsPDF, jsPDF: MockJsPDF }
})

describe('ReportGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getProjects).mockResolvedValue([
      { id: 'project-1', title: 'Test Project', genre: 'fantasy', targetSymbols: 100000, startDate: '2024-01-01', status: 'active', deadline: '2024-12-31' }
    ])
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
    vi.mocked(databaseService.getNotes).mockResolvedValue([])
  })

  it('should render title', async () => {
    render(<ReportGenerator />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Создать отчет')
    })
  })

  it('should show report type selection', async () => {
    render(<ReportGenerator />)
    await waitFor(() => {
      expect(screen.getByText('Дневной')).toBeInTheDocument()
      expect(screen.getByText('Недельный')).toBeInTheDocument()
      expect(screen.getByText('Месячный')).toBeInTheDocument()
      expect(screen.getByText('По проекту')).toBeInTheDocument()
    })
  })

  it('should show quick period selection', async () => {
    render(<ReportGenerator />)
    await waitFor(() => {
      expect(screen.getByText('Сегодня')).toBeInTheDocument()
      expect(screen.getByText('Эта неделя')).toBeInTheDocument()
      expect(screen.getByText('Этот месяц')).toBeInTheDocument()
    })
  })

  it('should show theme selection', async () => {
    render(<ReportGenerator />)
    await waitFor(() => {
      expect(screen.getByText('Светлая')).toBeInTheDocument()
      expect(screen.getByText('Тёмная')).toBeInTheDocument()
    })
  })

  it('should call data services when generating report', async () => {
    const user = userEvent.setup()
    render(<ReportGenerator />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    const generateButton = screen.getByRole('button', { name: 'Создать отчет' })
    await user.click(generateButton)

    await waitFor(() => {
      expect(databaseService.getEntries).toHaveBeenCalled()
      expect(databaseService.getSessions).toHaveBeenCalled()
      expect(databaseService.getProjects).toHaveBeenCalled()
      expect(databaseService.getNotes).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})
