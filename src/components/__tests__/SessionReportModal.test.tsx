import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import SessionReportModal from '../SessionReportModal'
import type { SessionData } from '../../services/reports/sessionCard'

vi.mock('../../services/reports/sessionCard', () => ({
  generateSessionPDF: vi.fn().mockResolvedValue({ save: vi.fn() }),
  generateSessionImage: vi.fn().mockResolvedValue('data:image/png;base64,test'),
  generateSessionStoryImage: vi.fn().mockResolvedValue('data:image/png;base64,test'),
  getSessionTextForCopy: vi.fn().mockReturnValue('Test text'),
}))
vi.mock('../../services/reports/reportSections', () => ({
  downloadDataUrl: vi.fn(),
}))
vi.mock('jspdf', () => {
  const MockJsPDF = vi.fn(() => ({
    save: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn(() => ['text']),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn()
  }))
  ;(MockJsPDF as any).API = { events: [] }
  return { default: MockJsPDF, jsPDF: MockJsPDF }
})

describe('SessionReportModal', () => {
  const mockSessionData: SessionData = {
    id: 'test-1',
    date: '2024-01-26T10:00:00',
    duration: 25,
    plannedDuration: 25,
    symbols: 500,
    speed: 20,
    mood: 'flow',
    projectTitle: 'Test Project'
  }

  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true
    })
  })

  it('не должен отображаться когда isOpen=false', () => {
    render(
      <SessionReportModal sessionData={mockSessionData} isOpen={false} onClose={mockOnClose} />
    )
    expect(screen.queryByText(/сессия завершена/i)).not.toBeInTheDocument()
  })

  it('должен отображаться когда isOpen=true', () => {
    render(
      <SessionReportModal sessionData={mockSessionData} isOpen={true} onClose={mockOnClose} />
    )
    expect(screen.getByText('Сессия завершена!')).toBeInTheDocument()
  })

  it('должен показывать данные сессии', () => {
    render(
      <SessionReportModal sessionData={mockSessionData} isOpen={true} onClose={mockOnClose} />
    )
    expect(screen.getByText(/500/)).toBeInTheDocument()
    expect(screen.getByText(/25/)).toBeInTheDocument()
  })

  it('должен показывать табы для соцсетей и печати', () => {
    render(
      <SessionReportModal sessionData={mockSessionData} isOpen={true} onClose={mockOnClose} />
    )
    expect(screen.getByText('Для соцсетей')).toBeInTheDocument()
    expect(screen.getByText('Для печати')).toBeInTheDocument()
  })

  it('должен генерировать PDF при клике на кнопку', async () => {
    const user = userEvent.setup()
    const { generateSessionPDF } = await import('../../services/reports/sessionCard')

    render(
      <SessionReportModal sessionData={mockSessionData} isOpen={true} onClose={mockOnClose} />
    )

    // Switch to print tab
    const printTab = screen.getByText('Для печати')
    await user.click(printTab)

    const pdfButton = screen.getByText(/скачать pdf/i)
    await user.click(pdfButton)

    await waitFor(() => {
      expect(generateSessionPDF).toHaveBeenCalled()
    })
  })

  it('должен копировать текст при клике на кнопку', async () => {
    const user = userEvent.setup()
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true
    })

    render(
      <SessionReportModal sessionData={mockSessionData} isOpen={true} onClose={mockOnClose} />
    )

    const copyButton = screen.getByText(/скопировать текст/i)
    await user.click(copyButton)

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('должен закрываться при клике на кнопку закрытия', async () => {
    const user = userEvent.setup()
    render(
      <SessionReportModal sessionData={mockSessionData} isOpen={true} onClose={mockOnClose} />
    )

    const closeButton = screen.getByText('Закрыть')
    await user.click(closeButton)
    expect(mockOnClose).toHaveBeenCalled()
  })
})
