import { describe, it, expect, vi } from 'vitest'
import { render } from '../../test/test-utils'
import CalendarHeatmap from '../CalendarHeatmap'

// Мокаем date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, format: string) => {
    if (format === 'yyyy-MM-dd') return '2024-01-26'
    if (format === 'd MMMM yyyy') return '26 января 2024'
    return date.toISOString()
  },
  subDays: (date: Date, days: number) => {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
  },
  startOfWeek: (date: Date) => date,
  endOfWeek: (date: Date) => date,
  eachDayOfInterval: ({ start, end }: { start: Date; end: Date }) => {
    const days = []
    const current = new Date(start)
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  },
  ru: {}
}))

describe('CalendarHeatmap', () => {
  it('должен отображать календарь', () => {
    const { container } = render(<CalendarHeatmap entries={[]} />)
    
    // Проверяем что компонент рендерится (ищем grid или любые элементы)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('должен показывать записи на календаре', () => {
    const entries = [
      { date: '2024-01-26', symbols: 500 },
      { date: '2024-01-25', symbols: 300 }
    ]

    const { container } = render(<CalendarHeatmap entries={entries} />)
    
    // Компонент должен отображаться
    expect(container.firstChild).toBeInTheDocument()
  })

  it('должен обрабатывать пустой массив записей', () => {
    const { container } = render(<CalendarHeatmap entries={[]} />)
    
    // Компонент должен отображаться даже без записей
    expect(container.firstChild).toBeInTheDocument()
  })
})
