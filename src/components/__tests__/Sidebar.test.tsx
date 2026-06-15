import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import Sidebar from '../Sidebar'

describe('Sidebar', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('должен отображать заголовок', () => {
    render(
      <Sidebar
        currentPage="home"
        onNavigate={mockOnNavigate}
      />
    )

    expect(screen.getByText(/Книготрек/i)).toBeInTheDocument()
  })

  it('должен отображать все пункты меню', () => {
    render(
      <Sidebar
        currentPage="home"
        onNavigate={mockOnNavigate}
      />
    )

    expect(screen.getByText(/Главная/i)).toBeInTheDocument()
    expect(screen.getByText(/Проекты/i)).toBeInTheDocument()
    expect(screen.getByText(/Заметки/i)).toBeInTheDocument()
    expect(screen.getByText(/Фокус/i)).toBeInTheDocument()
    expect(screen.getByText(/Синхронизация/i)).toBeInTheDocument()
    expect(screen.getByText(/Настройки/i)).toBeInTheDocument()
  })

  it('должен вызывать onNavigate при клике на пункт меню', async () => {
    const user = userEvent.setup()

    render(
      <Sidebar
        currentPage="home"
        onNavigate={mockOnNavigate}
      />
    )

    const projectsButton = screen.getByText(/Проекты/i)
    await user.click(projectsButton)

    expect(mockOnNavigate).toHaveBeenCalledWith('projects')
  })

  it('должен подсвечивать активную страницу', () => {
    render(
      <Sidebar
        currentPage="projects"
        onNavigate={mockOnNavigate}
      />
    )

    const projectsButton = screen.getByText(/Проекты/i)
    expect(projectsButton).toHaveClass('bg-indigo-800')
  })
})
