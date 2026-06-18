import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '../databaseService'
import {
  computeStats,
  evaluateAuto,
  buildViews,
  syncAchievements,
  markManual,
} from '../achievementsService'

vi.mock('../databaseService')

describe('achievementsService — чистые расчёты', () => {
  it('считает суммарные и дневные метрики', () => {
    const stats = computeStats(
      [
        { date: '2026-06-01', symbols: 1200 },
        { date: '2026-06-01', symbols: 800 }, // второй проект в тот же день
        { date: '2026-06-02', symbols: 500 },
      ],
      [
        { duration: 30, symbols: 1000 },
        { duration: 90, symbols: 2000 },
      ],
      [{ status: 'completed' }, { status: 'active' }],
      [{ status: 'done' }, { status: 'done' }, { status: 'planned' }],
    )

    expect(stats.totalSymbols).toBe(2500)
    expect(stats.activeDays).toBe(2)
    expect(stats.maxDaySymbols).toBe(2000) // 1200 + 800
    expect(stats.focusMinutes).toBe(120)
    expect(stats.totalSessions).toBe(2)
    expect(stats.maxSessionMinutes).toBe(90)
    expect(stats.maxSessionSymbols).toBe(2000)
    expect(stats.chaptersDone).toBe(2)
    expect(stats.completedProjects).toBe(1)
  })

  it('самая длинная серия — только подряд идущие дни', () => {
    const stats = computeStats(
      [
        { date: '2026-06-01', symbols: 100 },
        { date: '2026-06-02', symbols: 100 },
        { date: '2026-06-03', symbols: 100 }, // серия 3
        { date: '2026-06-05', symbols: 100 }, // разрыв
        { date: '2026-06-06', symbols: 100 },
      ],
      [], [], [],
    )
    expect(stats.longestStreak).toBe(3)
  })

  it('день с нулём символов не считается активным', () => {
    const stats = computeStats(
      [{ date: '2026-06-01', symbols: 0 }],
      [], [], [],
    )
    expect(stats.activeDays).toBe(0)
    expect(stats.longestStreak).toBe(0)
  })

  it('пустые данные не падают', () => {
    const stats = computeStats([], [], [], [])
    expect(stats.totalSymbols).toBe(0)
    expect(stats.maxDaySymbols).toBe(0)
    expect(stats.maxSessionMinutes).toBe(0)
  })

  it('evaluateAuto открывает достижения по достигнутым порогам', () => {
    const base = computeStats([], [], [], [])
    const met = evaluateAuto({ ...base, totalSymbols: 5000 })
    // объём 1000 и 5000 открыты, 25000 — нет
    expect(met).toContain('volume_1')
    expect(met).toContain('volume_2')
    expect(met).not.toContain('volume_3')
  })

  it('buildViews отдаёт прогресс к порогу', () => {
    const base = computeStats([], [], [], [])
    const views = buildViews({ ...base, totalSymbols: 500 }, new Set())
    const v1 = views.find((v) => v.id === 'volume_1')! // порог 1000
    expect(v1.unlocked).toBe(false)
    expect(v1.progress).toBeCloseTo(0.5)
  })

  it('эмоциональные (manual) не открываются авто — только по отметке', () => {
    const big = { ...computeStats([], [], [], []), totalSymbols: 9_999_999 }
    expect(evaluateAuto(big)).not.toContain('creative_tears')
    expect(buildViews(big, new Set()).find((v) => v.id === 'creative_tears')!.unlocked).toBe(false)
    expect(buildViews(big, new Set(['creative_tears'])).find((v) => v.id === 'creative_tears')!.unlocked).toBe(true)
  })
})

describe('achievementsService — персистентность', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.mocked(db.getSetting).mockImplementation(async (k: string) => store[k] ?? null)
    vi.mocked(db.setSetting).mockImplementation(async (k: string, v: string) => {
      store[k] = v
      return true
    })
  })

  it('первая инициализация фиксирует baseline без тостов', async () => {
    const base = computeStats([], [], [], [])
    const res = await syncAchievements({ ...base, totalSymbols: 5000 })
    // ничего не «всплывает», но состояние сохранено как открытое
    expect(res.newlyUnlocked).toHaveLength(0)
    expect(res.unlockedIds.has('volume_1')).toBe(true)
    expect(res.unlockedIds.has('volume_2')).toBe(true)
    expect(store['achievements_state']).toBeTruthy()
  })

  it('после инициализации новые достижения возвращаются для тоста', async () => {
    const base = computeStats([], [], [], [])
    await syncAchievements({ ...base, totalSymbols: 5000 }) // baseline
    const res = await syncAchievements({ ...base, totalSymbols: 25000 }) // дорос до volume_3
    const ids = res.newlyUnlocked.map((a) => a.id)
    expect(ids).toContain('volume_3')
    expect(ids).not.toContain('volume_1') // уже было
  })

  it('markManual открывает ручное достижение и оно сохраняется', async () => {
    await markManual('creative_twist')
    const res = await syncAchievements(computeStats([], [], [], []))
    expect(res.unlockedIds.has('creative_twist')).toBe(true)
  })

  it('разблокировка необратима: падение метрики не закрывает достижение', async () => {
    const base = computeStats([], [], [], [])
    await syncAchievements({ ...base, longestStreak: 7 }) // baseline со стриком
    const res = await syncAchievements({ ...base, longestStreak: 0 }) // стрик прервался
    expect(res.unlockedIds.has('streak_1')).toBe(true) // порог 3 — остаётся открытым
    expect(res.unlockedIds.has('streak_2')).toBe(true) // порог 7 — остаётся
  })
})
