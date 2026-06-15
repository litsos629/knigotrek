import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import FocusPage from '../FocusPage'
import * as databaseService from '../../services/databaseService'

// Мокаем компоненты
vi.mock('../../services/databaseService')

describe('FocusPage', () => {
  const defaultProps = {
    selectedProjectId: 'all',
    setSelectedProjectId: vi.fn(),
    timerDuration: 25,
    setTimerDuration: vi.fn(),
    timerTimeLeft: 25 * 60,
    setTimerTimeLeft: vi.fn(),
    timerIsRunning: false,
    setTimerIsRunning: vi.fn(),
    timerStartTime: null,
    setTimerStartTime: vi.fn(),
    timerIsFinished: false,
    setTimerIsFinished: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
    vi.mocked(databaseService.getProjects).mockResolvedValue([])
  })

  it('должен отображать заголовок', () => {
    render(<FocusPage {...defaultProps} />)
    expect(screen.getByText(/Режим Фокуса/i)).toBeInTheDocument()
  })

  it('должен показывать таймер с правильным временем', () => {
    render(<FocusPage {...defaultProps} />)
    
    // Формат времени: MM:SS
    expect(screen.getByText(/25:00/i)).toBeInTheDocument()
  })

  it('должен показывать кнопки длительности', () => {
    render(<FocusPage {...defaultProps} />)
    
    expect(screen.getByText('15 мин')).toBeInTheDocument()
    expect(screen.getByText('25 мин')).toBeInTheDocument()
    expect(screen.getByText('45 мин')).toBeInTheDocument()
    expect(screen.getByText('60 мин')).toBeInTheDocument()
  })

  it('должен запускать таймер', async () => {
    const user = userEvent.setup()
    const setTimerIsRunning = vi.fn()
    const setTimerStartTime = vi.fn()

    render(
      <FocusPage
        {...defaultProps}
        setTimerIsRunning={setTimerIsRunning}
        setTimerStartTime={setTimerStartTime}
      />
    )

    const startButton = screen.getByText('Старт')
    await user.click(startButton)

    expect(setTimerIsRunning).toHaveBeenCalledWith(true)
    expect(setTimerStartTime).toHaveBeenCalled()
  })

  it('должен ставить таймер на паузу', async () => {
    const user = userEvent.setup()
    const setTimerIsRunning = vi.fn()

    render(
      <FocusPage
        {...defaultProps}
        timerIsRunning={true}
        setTimerIsRunning={setTimerIsRunning}
      />
    )

    const pauseButton = screen.getByText('Пауза')
    await user.click(pauseButton)

    expect(setTimerIsRunning).toHaveBeenCalledWith(false)
  })

  it('должен сбрасывать таймер', async () => {
    const user = userEvent.setup()
    const setTimerTimeLeft = vi.fn()
    const setTimerIsRunning = vi.fn()
    const setTimerIsFinished = vi.fn()
    const setTimerStartTime = vi.fn()

    render(
      <FocusPage
        {...defaultProps}
        timerTimeLeft={1000}
        timerIsRunning={true}
        setTimerTimeLeft={setTimerTimeLeft}
        setTimerIsRunning={setTimerIsRunning}
        setTimerIsFinished={setTimerIsFinished}
        setTimerStartTime={setTimerStartTime}
      />
    )

    const resetButton = screen.getByText('Сброс')
    await user.click(resetButton)

    expect(setTimerTimeLeft).toHaveBeenCalledWith(25 * 60)
    expect(setTimerIsRunning).toHaveBeenCalledWith(false)
    expect(setTimerIsFinished).toHaveBeenCalledWith(false)
    expect(setTimerStartTime).toHaveBeenCalledWith(null)
  })

  it('должен показывать форму после завершения таймера', () => {
    render(
      <FocusPage
        {...defaultProps}
        timerIsFinished={true}
        timerTimeLeft={0}
      />
    )

    expect(screen.getByText(/Сессия завершена/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Например: 500/i)).toBeInTheDocument()
  })

  it('должен валидировать форму сохранения сессии', async () => {
    const user = userEvent.setup()

    render(
      <FocusPage
        {...defaultProps}
        timerIsFinished={true}
        timerTimeLeft={0}
      />
    )

    // Кнопка должна быть disabled, когда нет символов
    const saveButton = screen.getByText('Сохранить сессию')
    expect(saveButton).toBeDisabled()

    // Вводим невалидное значение (отрицательное число)
    const symbolsInput = screen.getByPlaceholderText(/Например: 500/i) as HTMLInputElement
    await user.type(symbolsInput, '-100')

    // Ждем, пока кнопка станет активной (теги не обязательны)
    const button = screen.getByText('Сохранить сессию')
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    }, { timeout: 3000 })

    // При клике компонент показывает toast (не window.alert)
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Введи количество символов')).toBeInTheDocument()
    })
  })

  it('должен сохранять сессию с валидными данными', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveSession).mockResolvedValue(true)
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    render(
      <FocusPage
        {...defaultProps}
        timerIsFinished={true}
        timerTimeLeft={0}
        timerDuration={25}
      />
    )

    const symbolsInput = screen.getByPlaceholderText(/Например: 500/i)
    await user.type(symbolsInput, '500')

    // Теги необязательны, можно сразу сохранять
    const saveButton = screen.getByText('Сохранить сессию')
    await user.click(saveButton)

    await waitFor(() => {
      expect(databaseService.saveSession).toHaveBeenCalled()
    })
  })

  it('должен вычислять скорость письма правильно', async () => {
    const user = userEvent.setup()
    vi.mocked(databaseService.saveSession).mockResolvedValue(true)
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
    vi.mocked(databaseService.getEntries).mockResolvedValue([])

    // Таймер работал 25 минут, осталось 0 секунд
    render(
      <FocusPage
        {...defaultProps}
        timerIsFinished={true}
        timerTimeLeft={0}
        timerDuration={25}
      />
    )

    const symbolsInput = screen.getByPlaceholderText(/Например: 500/i)
    await user.type(symbolsInput, '1250') // 1250 символов за 25 минут = 50 симв/мин

    const saveButton = screen.getByText('Сохранить сессию')
    await user.click(saveButton)

    await waitFor(() => {
      expect(databaseService.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: 1250,
          duration: 25,
          speed: 50 // 1250 / 25 = 50
        })
      )
    })
  })

  it('должен показывать историю сессий', async () => {
    const session = {
      id: '1',
      date: new Date().toISOString(),
      duration: 25,
      plannedDuration: 25,
      symbols: 500,
      speed: 20,
      mood: 'flow'
    }

    vi.mocked(databaseService.getSessions).mockResolvedValue([session])

    render(<FocusPage {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/500 символов за 25 мин/i)).toBeInTheDocument()
    })
  })
})
