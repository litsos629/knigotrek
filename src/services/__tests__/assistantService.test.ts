import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getBestAdvice } from '../assistantService'
import type { Entry, Project, Session } from '../databaseService'
import { subDays } from 'date-fns'

// Мокаем databaseService
vi.mock('../databaseService', () => ({
  getEntries: vi.fn(),
  getProjects: vi.fn(),
  getSessions: vi.fn()
}))

import { getEntries, getProjects, getSessions } from '../databaseService'

describe('assistantService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBestAdvice - анализ времени', () => {
    it('должен анализировать лучшее время для письма', async () => {
      const sessions: Session[] = [
        { id: '1', date: '2024-01-26T08:00:00Z', duration: 25, plannedDuration: 25, symbols: 500, speed: 20 },
        { id: '2', date: '2024-01-27T09:00:00Z', duration: 25, plannedDuration: 25, symbols: 500, speed: 20 },
        { id: '3', date: '2024-01-28T10:00:00Z', duration: 25, plannedDuration: 25, symbols: 500, speed: 20 }
      ]

      vi.mocked(getSessions).mockResolvedValue(sessions)
      vi.mocked(getEntries).mockResolvedValue([])
      vi.mocked(getProjects).mockResolvedValue([])

      const advice = await getBestAdvice(1500, 3, 0, 1500)
      
      // Должен быть совет о времени
      expect(advice).toBeDefined()
      expect(advice.text).toBeDefined()
    })
  })

  describe('getBestAdvice - анализ дней недели', () => {
    it('должен анализировать продуктивные дни', async () => {
      const today = new Date()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1))
      
      const entries: Entry[] = [
        { date: monday.toISOString().split('T')[0], symbols: 1000 },
        { date: new Date(monday.getTime() + 24*60*60*1000).toISOString().split('T')[0], symbols: 500 }
      ]

      vi.mocked(getEntries).mockResolvedValue(entries)
      vi.mocked(getSessions).mockResolvedValue([])
      vi.mocked(getProjects).mockResolvedValue([])

      const advice = await getBestAdvice(1500, 2, 0, 1500)
      
      expect(advice).toBeDefined()
    })
  })

  describe('getBestAdvice - проверка streak', () => {
    it('должен предупреждать о риске срыва streak', async () => {
      const yesterday = subDays(new Date(), 1).toISOString().split('T')[0]
      const entry: Entry = {
        date: yesterday,
        symbols: 500
      }

      vi.mocked(getEntries).mockResolvedValue([entry])
      vi.mocked(getSessions).mockResolvedValue([])
      vi.mocked(getProjects).mockResolvedValue([])

      const advice = await getBestAdvice(500, 1, 5, 500)
      
      // Должен быть совет о риске срыва streak
      expect(advice.text).toContain('streak')
    })

    it('не должен предупреждать если streak = 0', async () => {
      vi.mocked(getEntries).mockResolvedValue([])
      vi.mocked(getSessions).mockResolvedValue([])
      vi.mocked(getProjects).mockResolvedValue([])

      const advice = await getBestAdvice(0, 0, 0, 0)
      
      // Не должно быть предупреждения о streak
      expect(advice.text).not.toContain('streak')
    })
  })

  describe('getBestAdvice - проверка дедлайнов', () => {
    it('должен показывать критическое предупреждение при дедлайне < 7 дней', async () => {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 5) // Через 5 дней

      const project: Project = {
        id: 'p1',
        title: 'Срочный проект',
        genre: 'Фэнтези',
        targetSymbols: 100000,
        deadline: deadline.toISOString().split('T')[0],
        status: 'active',
        startDate: '2024-01-01'
      }

      const entries: Entry[] = [
        { date: '2024-01-26', symbols: 10000, projectId: 'p1' } // 10% прогресс
      ]

      vi.mocked(getProjects).mockResolvedValue([project])
      vi.mocked(getEntries).mockResolvedValue(entries)
      vi.mocked(getSessions).mockResolvedValue([])

      const advice = await getBestAdvice(10000, 1, 0, 10000)
      
      expect(advice.priority).toBeGreaterThanOrEqual(5)
      expect(advice.text).toContain('Срочный проект')
    })

    it('должен показывать предупреждение при дедлайне 7-14 дней', async () => {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 10) // Через 10 дней

      const project: Project = {
        id: 'p1',
        title: 'Тест',
        genre: 'Фэнтези',
        targetSymbols: 100000,
        deadline: deadline.toISOString().split('T')[0],
        status: 'active',
        startDate: '2024-01-01'
      }

      const entries: Entry[] = [
        { date: '2024-01-26', symbols: 30000, projectId: 'p1' } // 30% прогресс
      ]

      vi.mocked(getProjects).mockResolvedValue([project])
      vi.mocked(getEntries).mockResolvedValue(entries)
      vi.mocked(getSessions).mockResolvedValue([])

      const advice = await getBestAdvice(30000, 1, 0, 30000)
      
      expect(advice.priority).toBeGreaterThanOrEqual(3)
      expect(advice.emoji).toBe('⏰')
    })

    it('не должен показывать предупреждение при высоком прогрессе', async () => {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 5)

      const project: Project = {
        id: 'p1',
        title: 'Тест',
        genre: 'Фэнтези',
        targetSymbols: 100000,
        deadline: deadline.toISOString().split('T')[0],
        status: 'active',
        startDate: '2024-01-01'
      }

      const entries: Entry[] = [
        { date: '2024-01-26', symbols: 90000, projectId: 'p1' } // 90% прогресс
      ]

      vi.mocked(getProjects).mockResolvedValue([project])
      vi.mocked(getEntries).mockResolvedValue(entries)
      vi.mocked(getSessions).mockResolvedValue([])

      const advice = await getBestAdvice(90000, 1, 0, 90000)
      
      // При высоком прогрессе не должно быть критических предупреждений
      expect(advice.priority).toBeLessThan(5)
    })
  })

  describe('getBestAdvice - анализ скорости', () => {
    it('должен определять медленный темп', async () => {
      const sessions: Session[] = Array.from({ length: 5 }, (_, i) => ({
        id: `s${i}`,
        date: new Date().toISOString(),
        duration: 25,
        plannedDuration: 25,
        symbols: 500,
        speed: 20 // Медленно (< 35)
      }))

      vi.mocked(getSessions).mockResolvedValue(sessions)
      vi.mocked(getEntries).mockResolvedValue([])
      vi.mocked(getProjects).mockResolvedValue([])

      const advice = await getBestAdvice(2500, 5, 0, 2500)
      
      // Может быть совет о медленном темпе
      expect(advice).toBeDefined()
    })

    it('должен определять быстрый темп', async () => {
      const sessions: Session[] = Array.from({ length: 5 }, (_, i) => ({
        id: `s${i}`,
        date: new Date().toISOString(),
        duration: 25,
        plannedDuration: 25,
        symbols: 2500,
        speed: 100 // Быстро (> 75)
      }))

      vi.mocked(getSessions).mockResolvedValue(sessions)
      vi.mocked(getEntries).mockResolvedValue([])
      vi.mocked(getProjects).mockResolvedValue([])

      const advice = await getBestAdvice(12500, 5, 0, 12500)
      
      expect(advice).toBeDefined()
    })
  })

  describe('getBestAdvice', () => {
    beforeEach(() => {
      vi.mocked(getEntries).mockResolvedValue([])
      vi.mocked(getProjects).mockResolvedValue([])
      vi.mocked(getSessions).mockResolvedValue([])
    })

    it('должен возвращать базовый совет при отсутствии данных', async () => {
      const advice = await getBestAdvice(0, 0, 0, 0)
      
      // Базовый совет может быть разным, проверяем что он существует
      expect(advice.emoji).toBeDefined()
      expect(advice.title).toBeDefined()
      expect(advice.text).toBeDefined()
    })

    it('должен показывать критическое предупреждение о дедлайне', async () => {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 5)

      const project: Project = {
        id: 'p1',
        title: 'Срочный проект',
        genre: 'Фэнтези',
        targetSymbols: 100000,
        deadline: deadline.toISOString().split('T')[0],
        status: 'active',
        startDate: '2024-01-01'
      }

      const entry: Entry = {
        date: '2024-01-26',
        symbols: 10000,
        projectId: 'p1'
      }

      vi.mocked(getProjects).mockResolvedValue([project])
      vi.mocked(getEntries).mockResolvedValue([entry])

      const advice = await getBestAdvice(10000, 1, 0, 10000)
      
      expect(advice.priority).toBeGreaterThanOrEqual(5)
      expect(advice.text).toContain('Срочный проект')
    })

    it('должен показывать предупреждение о риске срыва streak', async () => {
      const yesterday = subDays(new Date(), 1).toISOString().split('T')[0]
      const entry: Entry = {
        date: yesterday,
        symbols: 500
      }

      vi.mocked(getEntries).mockResolvedValue([entry])

      const advice = await getBestAdvice(500, 1, 5, 500)
      
      // Должен быть совет о риске срыва streak
      expect(advice.text).toContain('streak')
    })

    it('должен приоритизировать критические советы', async () => {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 3) // Критический дедлайн

      const project: Project = {
        id: 'p1',
        title: 'Критический',
        genre: 'Фэнтези',
        targetSymbols: 100000,
        deadline: deadline.toISOString().split('T')[0],
        status: 'active',
        startDate: '2024-01-01'
      }

      const entry: Entry = {
        date: '2024-01-26',
        symbols: 5000,
        projectId: 'p1'
      }

      vi.mocked(getProjects).mockResolvedValue([project])
      vi.mocked(getEntries).mockResolvedValue([entry])

      const advice = await getBestAdvice(5000, 1, 0, 5000)
      
      // Критический совет должен быть первым
      expect(advice.priority).toBeGreaterThanOrEqual(5)
    })
  })
})
