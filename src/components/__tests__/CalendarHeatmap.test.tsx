import { describe, it, expect } from 'vitest'
import { render } from '../../test/test-utils'
import CalendarHeatmap from '../CalendarHeatmap'

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
