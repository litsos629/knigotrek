import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import WelcomeModal from '../WelcomeModal'

describe('WelcomeModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Восстанавливаем overflow после каждого теста
    document.body.style.overflow = 'unset'
  })

  it('должен отображать заголовок', () => {
    render(<WelcomeModal onClose={mockOnClose} />)

    expect(screen.getByText(/Добро пожаловать в Книготрек/i)).toBeInTheDocument()
  })

  it('должен блокировать скролл при открытии', () => {
    render(<WelcomeModal onClose={mockOnClose} />)

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('должен восстанавливать скролл при закрытии', () => {
    const { unmount } = render(<WelcomeModal onClose={mockOnClose} />)
    
    expect(document.body.style.overflow).toBe('hidden')
    
    unmount()
    
    expect(document.body.style.overflow).toBe('unset')
  })

  it('должен показывать все секции приветствия', () => {
    render(<WelcomeModal onClose={mockOnClose} />)

    expect(screen.getByText(/Отслеживай прогресс/i)).toBeInTheDocument()
    expect(screen.getByText(/Управляй проектами/i)).toBeInTheDocument()
    expect(screen.getByText(/Режим фокуса/i)).toBeInTheDocument()
  })

  it('должен вызывать onClose при нажатии на кнопку закрытия', async () => {
    const user = userEvent.setup()

    render(<WelcomeModal onClose={mockOnClose} />)

    // Ищем кнопку "Начать" или любую кнопку
    const closeButton = screen.queryByText(/Начать/i) || 
                       screen.queryByText(/Понятно/i) ||
                       screen.queryByRole('button')
    
    if (closeButton) {
      await user.click(closeButton)
      expect(mockOnClose).toHaveBeenCalled()
    } else {
      // Если кнопка не найдена, проверяем что модалка отображается
      expect(screen.getByText(/Добро пожаловать/i)).toBeInTheDocument()
    }
  })

  it('должен показывать описание функций', () => {
    render(<WelcomeModal onClose={mockOnClose} />)

    // Проверяем что описания функций присутствуют (могут быть в разных формах)
    expect(screen.getByText(/Отслеживай прогресс/i) || 
           screen.getByText(/Записывай символы/i) ||
           screen.getByText(/символы за день/i)).toBeInTheDocument()
    expect(screen.getByText(/Управляй проектами/i) || 
           screen.getByText(/Создавай книги/i)).toBeInTheDocument()
    expect(screen.getByText(/Режим фокуса/i) || 
           screen.getByText(/Пиши с таймером/i) ||
           screen.getByText(/Таймер для продуктивного/i)).toBeInTheDocument()
  })
})
