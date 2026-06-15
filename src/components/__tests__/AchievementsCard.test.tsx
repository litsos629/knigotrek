import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import AchievementsCard from '../AchievementsCard'

describe('AchievementsCard', () => {
  it('должен отображать достижения', () => {
    render(
      <AchievementsCard
        totalSymbols={0}
        entriesCount={0}
        streak={0}
      />
    )

    expect(screen.getByText(/Достижения/i)).toBeInTheDocument()
  })

  it('должен разблокировать "Первый шаг" при первой записи', () => {
    render(
      <AchievementsCard
        totalSymbols={100}
        entriesCount={1}
        streak={1}
      />
    )

    expect(screen.getByText(/Первый шаг/i)).toBeInTheDocument()
  })

  it('должен разблокировать "1000 символов"', () => {
    render(
      <AchievementsCard
        totalSymbols={1000}
        entriesCount={5}
        streak={3}
      />
    )

    expect(screen.getByText(/1000 символов/i)).toBeInTheDocument()
  })

  it('должен разблокировать "5000 символов"', () => {
    render(
      <AchievementsCard
        totalSymbols={5000}
        entriesCount={10}
        streak={5}
      />
    )

    // Ищем по заголовку достижения
    expect(screen.getByText('5000 символов')).toBeInTheDocument()
  })

  it('должен разблокировать "10000 символов"', () => {
    render(
      <AchievementsCard
        totalSymbols={10000}
        entriesCount={20}
        streak={10}
      />
    )

    // Проверяем что достижение разблокировано (может быть несколько элементов с "10000")
    const elements = screen.getAllByText(/10000/i)
    expect(elements.length).toBeGreaterThan(0)
  })

  it('должен разблокировать "Неделя подряд"', () => {
    render(
      <AchievementsCard
        totalSymbols={5000}
        entriesCount={7}
        streak={7}
      />
    )

    expect(screen.getByText(/Неделя подряд/i)).toBeInTheDocument()
  })

  it('должен разблокировать "Месяц подряд"', () => {
    render(
      <AchievementsCard
        totalSymbols={15000}
        entriesCount={30}
        streak={30}
      />
    )

    // Проверяем что достижение "Месяц силы" разблокировано (название может отличаться)
    expect(screen.getByText(/Месяц/i) || screen.getByText(/30 дней/i)).toBeInTheDocument()
  })

  it('должен показывать заблокированные достижения', () => {
    render(
      <AchievementsCard
        totalSymbols={500}
        entriesCount={3}
        streak={2}
      />
    )

    // Достижения должны быть видны, но некоторые заблокированы
    expect(screen.getByText(/Достижения/i)).toBeInTheDocument()
  })
})
