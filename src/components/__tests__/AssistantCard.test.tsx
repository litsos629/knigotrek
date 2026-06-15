import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/test-utils'
import AssistantCard from '../AssistantCard'
import * as assistantService from '../../services/assistantService'

// Мокаем assistantService
vi.mock('../../services/assistantService')

// Мокаем goalsService
vi.mock('../../services/goalsService', () => ({
  getActiveGoals: vi.fn().mockResolvedValue([]),
  refreshGoalProgress: vi.fn().mockResolvedValue([]),
}))

const defaultMocks = () => {
  vi.mocked(assistantService.getAdvices).mockResolvedValue([{
    emoji: '👋', title: 'Добро пожаловать!', text: 'Начни отслеживать свой прогресс', priority: 0
  }])
  vi.mocked(assistantService.getDailyPlan).mockResolvedValue({
    targetSymbols: 500, writtenToday: 0, progress: 0, completed: false,
    source: 'default', message: 'Осталось 500 символов до дневной цели'
  })
  vi.mocked(assistantService.getTagAnalytics).mockResolvedValue({
    topInsights: [], allTags: [], combinations: [],
    weekComparison: null, dailyFact: null, sparklineData: [], recentTrend: null
  })
  vi.mocked(assistantService.getPersonalRecommendations).mockResolvedValue({
    topRecs: [], timeSlots: [], durationBuckets: [], breakPattern: null, dailyRec: null
  })
  vi.mocked(assistantService.getProjectForecast).mockResolvedValue(null)
}

describe('AssistantCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultMocks()
  })

  it('должен отображать совет', async () => {
    render(
      <AssistantCard
        totalSymbols={0}
        entriesCount={0}
        streak={0}
        last7DaysSymbols={0}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Добро пожаловать/i)).toBeInTheDocument()
    })
  })

  it('должен вызывать getAdvices с правильными параметрами', async () => {
    vi.mocked(assistantService.getAdvices).mockResolvedValue([{
      emoji: '🔥', title: 'Отлично!', text: 'Продолжай в том же духе', priority: 1
    }])

    render(
      <AssistantCard
        totalSymbols={5000}
        entriesCount={10}
        streak={5}
        last7DaysSymbols={3500}
        selectedProjectId="project-1"
      />
    )

    await waitFor(() => {
      expect(assistantService.getAdvices).toHaveBeenCalledWith(5000, 10, 5, 3500, 'project-1')
    })
  })

  it('должен показывать средний темп', async () => {
    vi.mocked(assistantService.getAdvices).mockResolvedValue([{
      emoji: '📊', title: 'Статистика', text: 'Твой прогресс', priority: 0
    }])

    render(
      <AssistantCard
        totalSymbols={10000}
        entriesCount={20}
        streak={10}
        last7DaysSymbols={7000}
      />
    )

    await waitFor(() => {
      // Средний темп = 10000 / 20 = 500
      expect(screen.getByText(/500/i)).toBeInTheDocument()
    })
  })

  it('должен обрабатывать ошибки', async () => {
    vi.mocked(assistantService.getAdvices).mockRejectedValue(new Error('Ошибка'))

    render(
      <AssistantCard
        totalSymbols={0}
        entriesCount={0}
        streak={0}
        last7DaysSymbols={0}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Добро пожаловать/i)).toBeInTheDocument()
    })
  })

  it('должен показывать до 3 советов', async () => {
    vi.mocked(assistantService.getAdvices).mockResolvedValue([
      { emoji: '⚠️', title: 'Дедлайн', text: 'Близко!', priority: 5 },
      { emoji: '⏰', title: 'Время', text: 'Утром лучше', priority: 2 },
      { emoji: '🎯', title: 'Streak', text: 'Начни!', priority: 1 },
    ])

    render(
      <AssistantCard
        totalSymbols={1000}
        entriesCount={5}
        streak={3}
        last7DaysSymbols={700}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Дедлайн')).toBeInTheDocument()
      expect(screen.getByText('Время')).toBeInTheDocument()
      expect(screen.getByText('Streak')).toBeInTheDocument()
    })
  })

  it('должен обновлять советы при изменении пропсов', async () => {
    vi.mocked(assistantService.getAdvices).mockResolvedValue([{
      emoji: '🔥', title: 'Отлично!', text: 'Продолжай', priority: 1
    }])

    const { rerender } = render(
      <AssistantCard
        totalSymbols={1000}
        entriesCount={5}
        streak={3}
        last7DaysSymbols={700}
      />
    )

    await waitFor(() => {
      expect(assistantService.getAdvices).toHaveBeenCalledWith(1000, 5, 3, 700, undefined)
    })

    rerender(
      <AssistantCard
        totalSymbols={2000}
        entriesCount={10}
        streak={5}
        last7DaysSymbols={1400}
      />
    )

    await waitFor(() => {
      expect(assistantService.getAdvices).toHaveBeenCalledWith(2000, 10, 5, 1400, undefined)
    })
  })

  // === Новые тесты для A.7 ===

  describe('адаптивное поведение', () => {
    it('должен показывать приветствие при отсутствии данных', async () => {
      render(
        <AssistantCard
          totalSymbols={0}
          entriesCount={0}
          streak={0}
          last7DaysSymbols={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Добро пожаловать!')).toBeInTheDocument()
        expect(screen.getByText(/Введи количество написанных символов/i)).toBeInTheDocument()
        expect(screen.getByText('Отслеживай прогресс')).toBeInTheDocument()
        expect(screen.getByText('Получай советы')).toBeInTheDocument()
        expect(screen.getByText('Строй привычку')).toBeInTheDocument()
      })
    })

    it('должен показывать "Набираем данные" при малом количестве записей', async () => {
      render(
        <AssistantCard
          totalSymbols={500}
          entriesCount={2}
          streak={2}
          last7DaysSymbols={500}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Набираем данные')).toBeInTheDocument()
        expect(screen.getByText(/2 записи/)).toBeInTheDocument()
      })
    })

    it('должен показывать прогноз при наличии данных проекта', async () => {
      vi.mocked(assistantService.getProjectForecast).mockResolvedValue({
        projectTitle: 'Мой роман',
        avgSpeed: 500,
        daysNeeded: 30,
        projectedFinish: new Date(),
        daysAhead: 10,
        status: 'ahead',
        emoji: '🚀',
        title: 'Опережаешь график!',
        message: 'Темп 500 симв/день',
        progress: 40,
        totalWritten: 40000,
        targetSymbols: 100000
      })

      render(
        <AssistantCard
          totalSymbols={40000}
          entriesCount={80}
          streak={5}
          last7DaysSymbols={3500}
          selectedProjectId="p1"
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Мой роман: Опережаешь график!/)).toBeInTheDocument()
        expect(screen.getByText(/40.*000.*100.*000 символов/)).toBeInTheDocument()
      })
    })
  })

  describe('компактный режим', () => {
    it('должен сворачиваться при клике на кнопку свернуть', async () => {
      render(
        <AssistantCard
          totalSymbols={1000}
          entriesCount={10}
          streak={3}
          last7DaysSymbols={700}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Добро пожаловать/i)).toBeInTheDocument()
      })

      const collapseBtn = screen.getByLabelText('Свернуть')
      fireEvent.click(collapseBtn)

      // В компактном режиме показывается краткая информация
      expect(screen.getByLabelText('Развернуть')).toBeInTheDocument()
    })

    it('должен разворачиваться при клике на свёрнутую карточку', async () => {
      render(
        <AssistantCard
          totalSymbols={1000}
          entriesCount={10}
          streak={3}
          last7DaysSymbols={700}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Добро пожаловать/i)).toBeInTheDocument()
      })

      // Сворачиваем
      fireEvent.click(screen.getByLabelText('Свернуть'))
      expect(screen.getByLabelText('Развернуть')).toBeInTheDocument()

      // Разворачиваем кликом на карточку
      const expandBtn = screen.getByLabelText('Развернуть')
      fireEvent.click(expandBtn.closest('div')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Свернуть')).toBeInTheDocument()
      })
    })

    it('должен показывать краткую информацию в компактном режиме', async () => {
      vi.mocked(assistantService.getDailyPlan).mockResolvedValue({
        targetSymbols: 500, writtenToday: 200, progress: 40, completed: false,
        source: 'average', message: 'Осталось 300 символов'
      })

      render(
        <AssistantCard
          totalSymbols={5000}
          entriesCount={10}
          streak={3}
          last7DaysSymbols={3000}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Свернуть')).toBeInTheDocument()
      })

      // Сворачиваем
      fireEvent.click(screen.getByLabelText('Свернуть'))

      // В компактном режиме видим план на сегодня
      await waitFor(() => {
        expect(screen.getByText(/Сегодня: 200 \/ 500 символов/)).toBeInTheDocument()
      })
    })
  })

  describe('Детальные секции', () => {
    it('должен показывать превью и кнопку «Подробнее» для тегов', async () => {
      vi.mocked(assistantService.getTagAnalytics).mockResolvedValue({
        topInsights: [{ tag: 'кофе', avgSpeed: 5, sessionsCount: 10, diffPercent: 20, direction: 'up', text: 'кофе повышает скорость на 20%' }],
        allTags: [{ tag: 'кофе', avgSpeed: 5, sessionsCount: 10, diffPercent: 20, direction: 'up', text: 'кофе повышает скорость на 20%' }],
        combinations: [],
        weekComparison: null,
        dailyFact: null,
        sparklineData: [100, 200, 300, 400, 500, 600, 700],
        recentTrend: 'Последние 3 дня ты пишешь на 30% больше среднего'
      })

      render(
        <AssistantCard
          totalSymbols={5000}
          entriesCount={10}
          streak={3}
          last7DaysSymbols={3000}
        />
      )

      await waitFor(() => {
        // краткий инсайт виден
        expect(screen.getByText('кофе повышает скорость на 20%')).toBeInTheDocument()
        // кнопка «Подробнее»
        expect(screen.getByText('Подробнее')).toBeInTheDocument()
        // превью видно (обрезано)
        expect(screen.getByText(/Последние 3 дня/)).toBeInTheDocument()
      })
    })

    it('должен раскрывать детальную панель по клику', async () => {
      vi.mocked(assistantService.getTagAnalytics).mockResolvedValue({
        topInsights: [{ tag: 'кофе', avgSpeed: 5, sessionsCount: 10, diffPercent: 20, direction: 'up', text: 'кофе ускоряет' }],
        allTags: [{ tag: 'кофе', avgSpeed: 5, sessionsCount: 10, diffPercent: 20, direction: 'up', text: 'кофе ускоряет' }],
        combinations: [],
        weekComparison: null,
        dailyFact: null,
        sparklineData: [100, 200, 300, 400, 500, 600, 700],
        recentTrend: null
      })

      render(
        <AssistantCard
          totalSymbols={5000}
          entriesCount={10}
          streak={3}
          last7DaysSymbols={3000}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Подробнее')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Подробнее'))

      await waitFor(() => {
        expect(screen.getByText('Скрыть подробности')).toBeInTheDocument()
        expect(screen.getByText('Все теги:')).toBeInTheDocument()
      })
    })
  })
})
