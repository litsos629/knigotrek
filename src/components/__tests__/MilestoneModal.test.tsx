import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import MilestoneModal from '../MilestoneModal'
import { type MilestoneData } from '../../services/pdfService'
import * as pdfService from '../../services/pdfService'

vi.mock('../../services/pdfService')
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

describe('MilestoneModal', () => {
  const mockMilestoneData: MilestoneData = {
    project: {
      id: 'project-1',
      title: 'Test Project',
      genre: 'fantasy',
      targetSymbols: 100000,
      startDate: '2024-01-01'
    },
    stats: {
      totalSymbols: 50000,
      targetSymbols: 100000,
      progress: 50,
      daysWorked: 30,
      startDate: '2024-01-01',
      bestDay: 2500,
      averageSpeed: 1666,
      streak: 10
    }
  }

  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(pdfService.generateMilestoneReport).mockReturnValue({
      save: vi.fn()
    } as any)
  })

  it('не должен отображаться когда isOpen=false', () => {
    render(
      <MilestoneModal
        isOpen={false}
        onClose={mockOnClose}
        milestoneData={mockMilestoneData}
      />
    )
    
    expect(screen.queryByText(/50%/i)).not.toBeInTheDocument()
  })

  it('должен отображаться когда isOpen=true', () => {
    render(
      <MilestoneModal
        isOpen={true}
        onClose={mockOnClose}
        milestoneData={mockMilestoneData}
      />
    )
    
    expect(screen.getByText(/половина пути/i)).toBeInTheDocument()
    expect(screen.getByText(/50 000/i)).toBeInTheDocument()
  })

  it('должен показывать поздравление', () => {
    render(
      <MilestoneModal
        isOpen={true}
        onClose={mockOnClose}
        milestoneData={mockMilestoneData}
      />
    )
    
    expect(screen.getByText(/поздравляем/i)).toBeInTheDocument()
  })

  it('должен генерировать PDF при клике на кнопку', async () => {
    const user = userEvent.setup()
    render(
      <MilestoneModal
        isOpen={true}
        onClose={mockOnClose}
        milestoneData={mockMilestoneData}
      />
    )
    
    const pdfButton = screen.getByText(/скачать/i)
    await user.click(pdfButton)
    
    expect(pdfService.generateMilestoneReport).toHaveBeenCalledWith(mockMilestoneData)
  })

  it('должен закрываться при клике на кнопку закрытия', async () => {
    const user = userEvent.setup()
    render(
      <MilestoneModal
        isOpen={true}
        onClose={mockOnClose}
        milestoneData={mockMilestoneData}
      />
    )
    
    const closeButton = screen.getByText(/×/i)
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })
})
