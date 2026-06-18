import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../test/test-utils'
import AchievementsCard from '../AchievementsCard'
import * as svc from '../../services/achievementsService'

// Мокаем только обращения к БД (loadStats/syncAchievements); buildViews — настоящий
vi.mock('../../services/achievementsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/achievementsService')>()
  return { ...actual, loadStats: vi.fn(), syncAchievements: vi.fn() }
})

const zeroStats = {
  totalSymbols: 0, longestStreak: 0, activeDays: 0, focusMinutes: 0,
  totalSessions: 0, chaptersDone: 0, completedProjects: 0,
  maxSessionSymbols: 0, maxDaySymbols: 0, maxSessionMinutes: 0,
}

describe('AchievementsCard', () => {
  beforeEach(() => {
    vi.mocked(svc.loadStats).mockResolvedValue({ ...zeroStats })
    vi.mocked(svc.syncAchievements).mockResolvedValue({ unlockedIds: new Set(), newlyUnlocked: [] })
  })

  it('показывает заголовок сразу', () => {
    render(<AchievementsCard />)
    expect(screen.getByText('Достижения')).toBeInTheDocument()
  })

  it('после загрузки показывает семейства достижений', async () => {
    render(<AchievementsCard />)
    expect(await screen.findByText('Объём')).toBeInTheDocument()
    expect(screen.getByText('Серии')).toBeInTheDocument()
    expect(screen.getByText('Особые')).toBeInTheDocument()
  })

  it('считает открытые достижения в счётчике', async () => {
    vi.mocked(svc.loadStats).mockResolvedValue({ ...zeroStats, totalSymbols: 5000 })
    vi.mocked(svc.syncAchievements).mockResolvedValue({
      unlockedIds: new Set(['volume_1', 'volume_2']),
      newlyUnlocked: [],
    })
    render(<AchievementsCard />)
    // volume_1 (1000) и volume_2 (5000) открыты → счётчик «2/50»
    expect(await screen.findByText('2/50')).toBeInTheDocument()
  })
})
