import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import ShareProgressButton from '../ShareProgressButton'

vi.mock('../ShareProgressModal', () => ({
  default: ({ isOpen, onClose, template }: any) => {
    if (!isOpen) return null
    return (
      <div data-testid="share-modal">
        <div>Share Modal - {template}</div>
        <button onClick={onClose}>Close</button>
      </div>
    )
  }
}))

describe('ShareProgressButton', () => {
  const mockProps = {
    entries: [
      { date: '2024-01-26', symbols: 500 },
      { date: '2024-01-25', symbols: 300 }
    ],
    sessions: [
      { date: '2024-01-26T10:00:00', duration: 25, symbols: 500, speed: 20 }
    ],
    streak: 5,
    totalSymbols: 800,
    projectTitle: 'Test Project'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('должен отображать заголовок', () => {
    render(<ShareProgressButton {...mockProps} />)
    
    expect(screen.getByText(/поделиться прогрессом/i)).toBeInTheDocument()
  })

  it('должен показывать кнопки для разных шаблонов', () => {
    render(<ShareProgressButton {...mockProps} />)
    
    expect(screen.getByText(/прогресс за неделю/i)).toBeInTheDocument()
    expect(screen.getByText(/сегодняшняя сессия/i)).toBeInTheDocument()
    expect(screen.getByText(/Серия/i)).toBeInTheDocument()
  })

  it('должен открывать модалку при клике на шаблон', async () => {
    const user = userEvent.setup()
    render(<ShareProgressButton {...mockProps} />)
    
    const weekButton = screen.getByText(/прогресс за неделю/i)
    await user.click(weekButton)
    
    expect(screen.getByTestId('share-modal')).toBeInTheDocument()
    expect(screen.getByText(/Share Modal - week/)).toBeInTheDocument()
  })

  it('не должен показывать кнопку streak если streak=0', () => {
    render(<ShareProgressButton {...mockProps} streak={0} />)
    
    expect(screen.queryByText(/Серия: 0 дн/i)).not.toBeInTheDocument()
  })

  it('не должен показывать кнопку завершения если нет projectTitle', () => {
    render(<ShareProgressButton {...mockProps} projectTitle={undefined} />)
    
    expect(screen.queryByText(/завершение проекта/i)).not.toBeInTheDocument()
  })
})
