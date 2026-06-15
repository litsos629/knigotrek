import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import RecordsCard from '../RecordsCard'

describe('RecordsCard', () => {
  it('не должен отображаться при отсутствии записей', () => {
    render(<RecordsCard entries={[]} currentStreak={0} />)

    expect(screen.queryByText(/Лучший день/i)).not.toBeInTheDocument()
  })

  it('должен показывать лучший день', () => {
    const entries = [
      { date: '2024-01-26', symbols: 500 },
      { date: '2024-01-25', symbols: 1000 },
      { date: '2024-01-24', symbols: 300 }
    ]

    render(<RecordsCard entries={entries} currentStreak={3} />)
    
    // Компонент показывает "Лучший день" и количество символов
    expect(screen.getByText(/Лучший день/i)).toBeInTheDocument()
    // Формат может быть разным (1,000 или 1 000)
    expect(screen.getByText(/1[,\s]?000/i)).toBeInTheDocument()
  })

  it('должен показывать текущий streak', () => {
    const entries = [
      { date: '2024-01-26', symbols: 500 },
      { date: '2024-01-25', symbols: 300 }
    ]

    render(<RecordsCard entries={entries} currentStreak={5} />)
    
    expect(screen.getByText(/5/i)).toBeInTheDocument()
  })

  it('должен вычислять самый длинный streak', () => {
    const entries = [
      { date: '2024-01-20', symbols: 500 },
      { date: '2024-01-21', symbols: 300 },
      { date: '2024-01-22', symbols: 400 },
      { date: '2024-01-24', symbols: 200 }, // Пропуск дня
      { date: '2024-01-25', symbols: 300 }
    ]

    render(<RecordsCard entries={entries} currentStreak={2} />)
    
    // Компонент показывает «Самая длинная серия» и либо «Рекорд в прошлом», либо "Активен сейчас!"
    expect(screen.getByText(/Самая длинная серия/i)).toBeInTheDocument()
    // Самый длинный streak должен быть 3 (20, 21, 22)
    expect(screen.getByText(/3/i)).toBeInTheDocument()
  })

  it('должен показывать самую продуктивную неделю', () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-${20 + i}`,
      symbols: 500
    }))

    render(<RecordsCard entries={entries} currentStreak={7} />)
    
    // Должна быть показана продуктивная неделя
    expect(screen.getByText(/Неделя/i)).toBeInTheDocument()
  })
})
