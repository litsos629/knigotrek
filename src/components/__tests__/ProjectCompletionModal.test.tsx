import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import ProjectCompletionModal from '../ProjectCompletionModal'
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

describe('ProjectCompletionModal', () => {
  const mockMilestoneData: MilestoneData = {
    project: {
      id: 'project-1',
      title: 'Test Project',
      genre: 'fantasy',
      targetSymbols: 100000,
      startDate: '2024-01-01',
      deadline: '2024-12-31'
    },
    stats: {
      totalSymbols: 100000,
      targetSymbols: 100000,
      progress: 100,
      daysWorked: 100,
      startDate: '2024-01-01',
      completedDate: '2024-04-10',
      bestDay: 3000,
      averageSpeed: 1000,
      streak: 50,
      totalSessions: 10
    }
  }

  const mockProject = {
    id: 'project-1',
    title: 'Test Project',
    genre: 'fantasy',
    targetSymbols: 100000,
    startDate: '2024-01-01',
    deadline: '2024-12-31',
    status: 'completed' as const
  }

  const mockOnClose = vi.fn()
  const mockOnCreateNewProject = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(pdfService.generateFinalReport).mockReturnValue({
      save: vi.fn()
    } as any)
  })

  it('не должен отображаться когда isOpen=false', () => {
    render(
      <ProjectCompletionModal
        isOpen={false}
        onClose={mockOnClose}
        project={mockProject}
        milestoneData={mockMilestoneData}
        onCreateNewProject={mockOnCreateNewProject}
      />
    )
    
    expect(screen.queryByText(/проект завершен/i)).not.toBeInTheDocument()
  })

  it('должен отображаться когда isOpen=true', () => {
    render(
      <ProjectCompletionModal
        isOpen={true}
        onClose={mockOnClose}
        project={mockProject}
        milestoneData={mockMilestoneData}
        onCreateNewProject={mockOnCreateNewProject}
      />
    )
    
    expect(screen.getByText(/проект завершен/i)).toBeInTheDocument()
  })

  it('должен показывать поздравление', () => {
    render(
      <ProjectCompletionModal
        isOpen={true}
        onClose={mockOnClose}
        project={mockProject}
        milestoneData={mockMilestoneData}
        onCreateNewProject={mockOnCreateNewProject}
      />
    )
    
    expect(screen.getByText(/поздравляем/i)).toBeInTheDocument()
  })

  it('должен генерировать PDF при клике на кнопку', async () => {
    const user = userEvent.setup()
    render(
      <ProjectCompletionModal
        isOpen={true}
        onClose={mockOnClose}
        project={mockProject}
        milestoneData={mockMilestoneData}
        onCreateNewProject={mockOnCreateNewProject}
      />
    )
    
    const pdfButton = screen.getByText(/создать итоговый отчет/i)
    await user.click(pdfButton)
    
    expect(pdfService.generateFinalReport).toHaveBeenCalledWith(mockMilestoneData)
  })

  it('должен закрываться при клике на кнопку закрытия', async () => {
    const user = userEvent.setup()
    render(
      <ProjectCompletionModal
        isOpen={true}
        onClose={mockOnClose}
        project={mockProject}
        milestoneData={mockMilestoneData}
        onCreateNewProject={mockOnCreateNewProject}
      />
    )
    
    const closeButton = screen.getByText(/закрыть/i)
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })
})
