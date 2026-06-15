import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateSessionMicroReport,
  getSessionTextForCopy,
  generateMilestoneReport,
  generateFinalReport,
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  generateProjectReport,
  type SessionData,
  type MilestoneData,
  type ReportConfig,
  type ReportData
} from '../pdfService'

// Мокаем html2canvas - возвращаем canvas с валидным PNG data URL
vi.mock('html2canvas', () => ({
  default: vi.fn((_element: HTMLElement) => {
    // Создаем canvas элемент
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    
    // Мокаем toDataURL для возврата валидного PNG
    const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    canvas.toDataURL = vi.fn(() => `data:image/png;base64,${validPngBase64}`)
    
    return Promise.resolve(canvas)
  })
}))

// Мокаем document.body для тестовой среды
beforeEach(() => {
  if (typeof document !== 'undefined' && !document.body) {
    document.body = document.createElement('body')
  }
})

describe('pdfService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateSessionMicroReport', () => {
    it('должен создавать PDF документ', async () => {
      const sessionData: SessionData = {
        id: 'test-1',
        date: '2024-01-26T10:00:00',
        duration: 25,
        plannedDuration: 25,
        symbols: 500,
        speed: 20,
        mood: 'flow',
        projectTitle: 'Test Project'
      }

      const doc = await generateSessionMicroReport(sessionData)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })

    it('должен обрабатывать сессию без настроения', async () => {
      const sessionData: SessionData = {
        id: 'test-2',
        date: '2024-01-26T10:00:00',
        duration: 25,
        plannedDuration: 25,
        symbols: 500,
        speed: 20
      }

      const doc = await generateSessionMicroReport(sessionData)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })

    it('должен обрабатывать сессию с заметкой', async () => {
      const sessionData: SessionData = {
        id: 'test-3',
        date: '2024-01-26T10:00:00',
        duration: 25,
        plannedDuration: 25,
        symbols: 500,
        speed: 20,
        note: 'Test note'
      }

      const doc = await generateSessionMicroReport(sessionData)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })
  })

  describe('getSessionTextForCopy', () => {
    it('должен генерировать текстовую версию', () => {
      const sessionData: SessionData = {
        id: 'test-1',
        date: '2024-01-26T10:00:00',
        duration: 25,
        plannedDuration: 25,
        symbols: 500,
        speed: 20,
        mood: 'flow'
      }

      const text = getSessionTextForCopy(sessionData)
      expect(text).toContain('СЕССИЯ ЗАВЕРШЕНА')
      expect(text).toContain('500')
      expect(text).toContain('25')
    })

    it('должен включать теги если есть', () => {
      const sessionData: SessionData = {
        id: 'test-1',
        date: '2024-01-26T10:00:00',
        duration: 25,
        plannedDuration: 25,
        symbols: 500,
        speed: 20,
        mood: 'flow'
      }

      const text = getSessionTextForCopy(sessionData)
      expect(text).toContain('#впотоке')
    })
  })

  describe('generateMilestoneReport', () => {
    it('должен создавать PDF для milestone', async () => {
      const milestoneData: MilestoneData = {
        project: {
          id: 'project-1',
          title: 'Test Project',
          genre: 'fantasy',
          targetSymbols: 100000,
          startDate: '2024-01-01'
        },
        stats: {
          totalSymbols: 50000,
          targetSymbols: 100000,
          progress: 50,
          daysWorked: 30,
          startDate: '2024-01-01',
          bestDay: 2500,
          averageSpeed: 1666,
          streak: 10
        }
      }

      const doc = await generateMilestoneReport(milestoneData)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })
  })

  describe('generateFinalReport', () => {
    it('должен создавать PDF для завершенного проекта', async () => {
      const milestoneData: MilestoneData = {
        project: {
          id: 'project-1',
          title: 'Test Project',
          genre: 'fantasy',
          targetSymbols: 100000,
          startDate: '2024-01-01',
          deadline: '2024-12-31'
        },
        stats: {
          totalSymbols: 100000,
          targetSymbols: 100000,
          progress: 100,
          daysWorked: 100,
          startDate: '2024-01-01',
          completedDate: '2024-04-10',
          deadline: '2024-12-31',
          bestDay: 3000,
          averageSpeed: 1000,
          streak: 50
        }
      }

      const doc = await generateFinalReport(milestoneData)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })
  })

  describe('generateDailyReport', () => {
    it('должен создавать дневной отчет', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-26', to: '2024-01-26' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: true,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }

      const data: ReportData = {
        entries: [
          { date: '2024-01-26', symbols: 500, projectId: 'project-1' }
        ],
        sessions: [
          { date: '2024-01-26T10:00:00', duration: 25, symbols: 500, speed: 20 }
        ],
        projects: [
          { id: 'project-1', title: 'Test Project', genre: 'fantasy', targetSymbols: 100000, startDate: '2024-01-01' }
        ]
      }

      const doc = await generateDailyReport('2024-01-26', data, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })
  })

  describe('generateWeeklyReport', () => {
    it('должен создавать недельный отчет', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-20', to: '2024-01-26' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: true,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }

      const data: ReportData = {
        entries: [
          { date: '2024-01-20', symbols: 500 },
          { date: '2024-01-21', symbols: 600 },
          { date: '2024-01-22', symbols: 700 }
        ],
        sessions: [],
        projects: []
      }

      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', data, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })
  })

  describe('generateMonthlyReport', () => {
    it('должен создавать месячный отчет', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-01', to: '2024-01-31' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: true,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }

      const data: ReportData = {
        entries: [
          { date: '2024-01-01', symbols: 500 },
          { date: '2024-01-02', symbols: 600 }
        ],
        sessions: [],
        projects: []
      }

      const doc = await generateMonthlyReport(1, 2024, data, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })
  })

  describe('generateProjectReport', () => {
    it('должен создавать отчет по проекту', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-01', to: '2024-01-31' },
        projectId: 'project-1',
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: true,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }

      const data: ReportData = {
        entries: [
          { date: '2024-01-01', symbols: 500, projectId: 'project-1' }
        ],
        sessions: [],
        projects: [
          { id: 'project-1', title: 'Test Project', genre: 'fantasy', targetSymbols: 100000, startDate: '2024-01-01' }
        ]
      }

      const doc = await generateProjectReport('project-1', data, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
      expect(typeof doc.save).toBe('function')
    })

    it('должен выбрасывать ошибку если проект не найден', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-01', to: '2024-01-31' },
        projectId: 'nonexistent',
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: true,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }

      const data: ReportData = {
        entries: [],
        sessions: [],
        projects: []
      }

      await expect(generateProjectReport('nonexistent', data, config)).rejects.toThrow('Project not found')
    })
  })

  // ========== ТЕСТЫ ДЛЯ МОДЕРНИЗАЦИИ ОТЧЕТОВ ==========

  describe('Модернизация отчетов: Типы отчетов', () => {
    const baseConfig: ReportConfig = {
      type: 'detailed',
      period: { from: '2024-01-20', to: '2024-01-26' },
      include: {
        generalStats: true,
        progress: true,
        workingDays: true,
        averageSpeed: true,
        progressChart: false,
        calendarHeatmap: false,
        weekdayDynamics: false,
        timeDistribution: false,
        sessionsCount: true,
        averageSessionDuration: true,
        detailedSessions: false,
        moods: true,
        achievements: true,
        records: true,
        periodComparison: false,
        frequentMoods: false,
        moodProductivityCorrelation: false,
        optimalTime: false,
        notes: false
      },
      style: 'professional'
    }

    const baseData: ReportData = {
      entries: [
        { date: '2024-01-20', symbols: 500 },
        { date: '2024-01-21', symbols: 600 },
        { date: '2024-01-22', symbols: 700 }
      ],
      sessions: [
        { date: '2024-01-20T10:00:00', duration: 25, symbols: 500, speed: 20, mood: 'focused' },
        { date: '2024-01-21T10:00:00', duration: 30, symbols: 600, speed: 20 }
      ],
      projects: []
    }

    it('должен создавать детальный отчет (detailed)', async () => {
      const config = { ...baseConfig, type: 'detailed' as const }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
    })

    it('должен создавать краткий отчет (brief)', async () => {
      const config = { ...baseConfig, type: 'brief' as const }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
    })

    it('должен создавать сертификат (certificate)', async () => {
      const config = { ...baseConfig, type: 'certificate' as const }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
    })
  })

  describe('Модернизация отчетов: Стили оформления', () => {
    const baseConfig: ReportConfig = {
      type: 'detailed',
      period: { from: '2024-01-20', to: '2024-01-26' },
      include: {
        generalStats: true,
        progress: true,
        workingDays: true,
        averageSpeed: true,
        progressChart: false,
        calendarHeatmap: false,
        weekdayDynamics: false,
        timeDistribution: false,
        sessionsCount: true,
        averageSessionDuration: true,
        detailedSessions: false,
        moods: false,
        achievements: false,
        records: false,
        periodComparison: false,
        frequentMoods: false,
        moodProductivityCorrelation: false,
        optimalTime: false,
        notes: false
      },
      style: 'professional'
    }

    const baseData: ReportData = {
      entries: [{ date: '2024-01-20', symbols: 500 }],
      sessions: [],
      projects: []
    }

    it('должен применять профессиональный стиль', async () => {
      const config = { ...baseConfig, style: 'professional' as const }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })

    it('должен применять яркий стиль', async () => {
      const config = { ...baseConfig, style: 'bright' as const }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })

    it('должен применять печатный стиль', async () => {
      const config = { ...baseConfig, style: 'printable' as const }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })
  })

  describe('Модернизация отчетов: Опции config.include', () => {
    const baseData: ReportData = {
      entries: [
        { date: '2024-01-20', symbols: 500 },
        { date: '2024-01-21', symbols: 600 }
      ],
      sessions: [
        { date: '2024-01-20T10:00:00', duration: 25, symbols: 500, speed: 20, mood: 'focused' }
      ],
      projects: [
        { id: 'project-1', title: 'Test Project', genre: 'fantasy', targetSymbols: 100000, startDate: '2024-01-01' }
      ],
      notes: [
        { id: 'note-1', title: 'Test Note', content: 'Test content', date: '2024-01-20T10:00:00' }
      ]
    }

    it('должен включать график прогресса если progressChart = true', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-20', to: '2024-01-26' },
        projectId: 'project-1',
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: true,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: false,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })

    it('должен включать календарь активности если calendarHeatmap = true', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-20', to: '2024-01-26' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: true,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: false,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })

    it('должен включать достижения если achievements = true', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-20', to: '2024-01-26' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: false,
          achievements: true,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })

    it('должен включать рекорды если records = true', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-20', to: '2024-01-26' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: false,
          achievements: false,
          records: true,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })

    it('должен включать заметки если notes = true', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-20', to: '2024-01-26' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: false,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: true
        },
        style: 'professional'
      }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', baseData, config)
      expect(doc).toBeDefined()
    })

    it('должен включать сравнение периодов если periodComparison = true', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-20', to: '2024-01-26' },
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: false,
          achievements: false,
          records: false,
          periodComparison: true,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }
      // Добавляем данные за предыдущую неделю
      const dataWithPrevious: ReportData = {
        ...baseData,
        entries: [
          ...baseData.entries!,
          { date: '2024-01-13', symbols: 400 },
          { date: '2024-01-14', symbols: 500 }
        ]
      }
      const doc = await generateWeeklyReport('2024-01-20', '2024-01-26', dataWithPrevious, config)
      expect(doc).toBeDefined()
    })
  })

  describe('Модернизация отчетов: Проектные отчеты', () => {
    it('должен включать прогресс к цели если progress = true', async () => {
      const config: ReportConfig = {
        type: 'detailed',
        period: { from: '2024-01-01', to: '2024-01-31' },
        projectId: 'project-1',
        include: {
          generalStats: true,
          progress: true,
          workingDays: true,
          averageSpeed: true,
          progressChart: false,
          calendarHeatmap: false,
          weekdayDynamics: false,
          timeDistribution: false,
          sessionsCount: true,
          averageSessionDuration: true,
          detailedSessions: false,
          moods: false,
          achievements: false,
          records: false,
          periodComparison: false,
          frequentMoods: false,
          moodProductivityCorrelation: false,
          optimalTime: false,
          notes: false
        },
        style: 'professional'
      }

      const data: ReportData = {
        entries: [
          { date: '2024-01-01', symbols: 5000, projectId: 'project-1' }
        ],
        sessions: [],
        projects: [
          { id: 'project-1', title: 'Test Project', genre: 'fantasy', targetSymbols: 100000, startDate: '2024-01-01' }
        ]
      }

      const doc = await generateProjectReport('project-1', data, config)
      expect(doc).toBeDefined()
      expect(doc.save).toBeDefined()
    })
  })
})
