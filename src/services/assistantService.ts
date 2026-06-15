import { getEntries, getProjects, getSessions, type Entry, type Project, type Session } from './databaseService'
import { differenceInDays, getDay, subDays, format } from 'date-fns'
import { getSessionTags } from '../config/appConfig'
import i18n from '../i18n'
import { formatNumber } from '../i18n/dateLocale'
import { toLocalDateString } from '../utils/dates'

/** Перевод строки из namespace `assistant`. */
const t = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(key, { ns: 'assistant', ...opts }) as string

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
/** Локализованное название дня недели по индексу JS-даты (0 = воскресенье). */
const weekdayName = (index: number): string => t(`weekdays.${WEEKDAY_KEYS[index]}`)
/** Первая буква заглавная — для дней недели в начале фразы. */
const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export interface AssistantAdvice {
  emoji: string
  title: string
  text: string
  priority: number
}

interface UserStats {
  totalSymbols: number
  entriesCount: number
  streak: number
  last7DaysSymbols: number
  entries: Entry[]
  sessions: Session[]
  projects: Project[]
  lastEntryDate?: string
  selectedProjectId?: string
}

// Анализ лучшего времени для письма
function analyzeBestTime(sessions: Session[]): string | null {
  if (sessions.length === 0) return null

  const timeSlots = {
    morning: 0,    // 6-12
    afternoon: 0, // 12-18
    evening: 0,   // 18-22
    night: 0      // 22-6
  }

  sessions.forEach(session => {
    try {
      const hour = new Date(session.date).getHours()
      if (hour >= 6 && hour < 12) timeSlots.morning++
      else if (hour >= 12 && hour < 18) timeSlots.afternoon++
      else if (hour >= 18 && hour < 22) timeSlots.evening++
      else timeSlots.night++
    } catch (e) {
      // Игнорируем ошибки парсинга даты
    }
  })

  const best = Object.entries(timeSlots).reduce((a, b) =>
    timeSlots[a[0] as keyof typeof timeSlots] > timeSlots[b[0] as keyof typeof timeSlots] ? a : b
  )

  const labels = {
    morning: t('timeLabels.morning'),
    afternoon: t('timeLabels.afternoon'),
    evening: t('timeLabels.evening'),
    night: t('timeLabels.night')
  }

  return labels[best[0] as keyof typeof labels]
}

// Анализ продуктивных дней недели
function analyzeBestDay(entries: Entry[]): string | null {
  if (entries.length === 0) return null

  const dayCounts = [0, 0, 0, 0, 0, 0, 0]

  entries.forEach(entry => {
    try {
      const day = getDay(new Date(entry.date))
      dayCounts[day] += entry.symbols
    } catch (e) {
      // Игнорируем ошибки
    }
  })

  const bestDayIndex = dayCounts.indexOf(Math.max(...dayCounts))
  return weekdayName(bestDayIndex)
}

// Проверка риска срыва streak
function checkStreakRisk(lastEntryDate: string | undefined, currentStreak: number): boolean {
  if (!lastEntryDate || currentStreak === 0) return false

  try {
    const lastDate = new Date(lastEntryDate)
    const today = new Date()
    const daysSince = differenceInDays(today, lastDate)

    // Если streak > 0 и последняя запись была вчера, есть риск срыва
    return currentStreak > 0 && daysSince === 1
  } catch {
    return false
  }
}

// Проверка дедлайнов проектов
function checkProjectDeadlines(projects: Project[], entries: Entry[]): AssistantAdvice | null {
  const activeProjects = projects.filter(p => p.status === 'active' && p.deadline)

  for (const project of activeProjects) {
    const daysLeft = differenceInDays(new Date(project.deadline!), new Date())
    const projectEntries = entries.filter(e => e.projectId === project.id)
    const total = projectEntries.reduce((sum, e) => sum + e.symbols, 0)
    const progress = Math.min(Math.round((total / project.targetSymbols) * 100), 100)

    // Просроченный дедлайн
    if (daysLeft <= 0) {
      const overdueDays = Math.abs(daysLeft)
      return {
        emoji: '🚨',
        title: t('advice.deadlineOverdueTitle'),
        text: t('advice.deadlineOverdueText', { project: project.title, days: overdueDays }),
        priority: 6
      }
    }

    // Критический дедлайн (менее 7 дней)
    if (daysLeft > 0 && daysLeft < 7 && progress < 80) {
      const remaining = project.targetSymbols - total
      const needed = Math.ceil(remaining / daysLeft)

      return {
        emoji: '⚠️',
        title: t('advice.deadlineCriticalTitle'),
        text: t('advice.deadlineCriticalText', { project: project.title, days: daysLeft, progress, needed: formatNumber(needed) }),
        priority: 5
      }
    }

    // Предупреждение (7-14 дней)
    if (daysLeft >= 7 && daysLeft < 14 && progress < 60) {
      const remaining = project.targetSymbols - total
      const needed = Math.ceil(remaining / daysLeft)

      return {
        emoji: '⏰',
        title: t('advice.deadlineWarningTitle'),
        text: t('advice.deadlineWarningText', { project: project.title, days: daysLeft, needed: formatNumber(needed) }),
        priority: 3
      }
    }
  }

  return null
}

// Анализ скорости письма
function analyzeWritingSpeed(sessions: Session[]): AssistantAdvice | null {
  if (sessions.length < 5) return null

  const speeds = sessions
    .filter(s => s.speed > 0)
    .map(s => s.speed)

  if (speeds.length === 0) return null

  const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length
  const optimalSpeed = 50 // символов в минуту

  if (avgSpeed < optimalSpeed * 0.7) {
    return {
      emoji: '🐢',
      title: t('advice.speedSlowTitle'),
      text: t('advice.speedSlowText', { speed: Math.round(avgSpeed) }),
      priority: 2
    }
  } else if (avgSpeed > optimalSpeed * 1.5) {
    return {
      emoji: '⚡',
      title: t('advice.speedFastTitle'),
      text: t('advice.speedFastText', { speed: Math.round(avgSpeed) }),
      priority: 1
    }
  }

  return null
}

// Получить все советы (до 3), отсортированные по приоритету с ротацией
export async function getAdvices(
  totalSymbols: number,
  entriesCount: number,
  streak: number,
  last7DaysSymbols: number,
  selectedProjectId?: string
): Promise<AssistantAdvice[]> {
  const entries = await getEntries()
  const sessions = await getSessions()
  const projects = await getProjects()

  // Сортируем entries по дате (новые первые) для корректного lastEntryDate
  const sortedEntries = [...entries].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Фильтруем по проекту если выбран
  const filteredEntries = selectedProjectId && selectedProjectId !== 'all'
    ? entries.filter(e => e.projectId === selectedProjectId)
    : entries
  const filteredSessions = selectedProjectId && selectedProjectId !== 'all'
    ? sessions.filter(s => s.projectId === selectedProjectId)
    : sessions
  const relevantProjects = selectedProjectId && selectedProjectId !== 'all'
    ? projects.filter(p => p.id === selectedProjectId)
    : projects

  const stats: UserStats = {
    totalSymbols,
    entriesCount,
    streak,
    last7DaysSymbols,
    entries: filteredEntries,
    sessions: filteredSessions,
    projects: relevantProjects,
    lastEntryDate: sortedEntries.length > 0 ? sortedEntries[0].date : undefined,
    selectedProjectId
  }

  const advices: AssistantAdvice[] = []

  // 1. Критические предупреждения (высокий приоритет)
  const deadlineAdvice = checkProjectDeadlines(stats.projects, entries)
  if (deadlineAdvice) {
    advices.push(deadlineAdvice)
  }

  // 2. Риск срыва streak
  if (checkStreakRisk(stats.lastEntryDate, stats.streak)) {
    advices.push({
      emoji: '⏳',
      title: t('advice.streakRiskTitle'),
      text: t('advice.streakRiskText', { streak: stats.streak }),
      priority: 4
    })
  }

  // 3. Анализ времени (если есть сессии)
  if (stats.sessions.length > 5) {
    const bestTime = analyzeBestTime(stats.sessions)
    if (bestTime) {
      advices.push({
        emoji: '⏰',
        title: t('advice.bestTimeTitle'),
        text: t('advice.bestTimeText', { time: bestTime }),
        priority: 2
      })
    }
  }

  // 4. Анализ дней недели
  if (stats.entries.length > 10) {
    const bestDay = analyzeBestDay(stats.entries)
    if (bestDay) {
      advices.push({
        emoji: '📅',
        title: t('advice.bestDayTitle'),
        text: t('advice.bestDayText', { day: capitalize(bestDay) }),
        priority: 1
      })
    }
  }

  // 5. Анализ скорости
  const speedAdvice = analyzeWritingSpeed(stats.sessions)
  if (speedAdvice) {
    advices.push(speedAdvice)
  }

  // 6. Базовые советы (низкий приоритет)
  const avgPerDay = stats.entriesCount > 0 ? Math.round(stats.totalSymbols / stats.entriesCount) : 0

  if (stats.streak === 0) {
    advices.push({
      emoji: '🎯',
      title: t('advice.startStreakTitle'),
      text: t('advice.startStreakText'),
      priority: 1
    })
  } else if (stats.streak >= 1 && stats.streak < 3) {
    advices.push({
      emoji: '🔥',
      title: t('advice.streakGoodStartTitle'),
      text: t('advice.streakGoodStartText', {
        streak: stats.streak,
        word: t(stats.streak === 1 ? 'advice.dayWordOne' : 'advice.dayWordFew')
      }),
      priority: 1
    })
  } else if (stats.streak >= 3 && stats.streak < 7) {
    advices.push({
      emoji: '💪',
      title: t('advice.streakOnFireTitle'),
      text: t('advice.streakOnFireText', { streak: stats.streak, remaining: 21 - stats.streak }),
      priority: 1
    })
  } else if (stats.streak >= 7) {
    advices.push({
      emoji: '⭐',
      title: t('advice.streakIncredibleTitle'),
      text: t('advice.streakIncredibleText', { streak: stats.streak }),
      priority: 1
    })
  }

  if (avgPerDay > 0 && avgPerDay < 300) {
    advices.push({
      emoji: '🌱',
      title: t('advice.paceSlowTitle'),
      text: t('advice.paceSlowText', { avg: avgPerDay }),
      priority: 0
    })
  } else if (avgPerDay >= 300 && avgPerDay < 700) {
    advices.push({
      emoji: '🚀',
      title: t('advice.paceGoodTitle'),
      text: t('advice.paceGoodText', { avg: avgPerDay }),
      priority: 0
    })
  } else if (avgPerDay >= 700) {
    advices.push({
      emoji: '⚡',
      title: t('advice.paceFastTitle'),
      text: t('advice.paceFastText', { avg: avgPerDay }),
      priority: 0
    })
  }

  if (stats.last7DaysSymbols === 0) {
    advices.push({
      emoji: '📝',
      title: t('advice.weekEmptyTitle'),
      text: t('advice.weekEmptyText'),
      priority: 2
    })
  } else if (stats.last7DaysSymbols > 0 && stats.last7DaysSymbols < 1000) {
    advices.push({
      emoji: '💡',
      title: t('advice.weekQuietTitle'),
      text: t('advice.weekQuietText'),
      priority: 1
    })
  } else if (stats.last7DaysSymbols >= 1000) {
    advices.push({
      emoji: '🎉',
      title: t('advice.weekProductiveTitle'),
      text: t('advice.weekProductiveText', { symbols: formatNumber(stats.last7DaysSymbols) }),
      priority: 0
    })
  }

  // Сортируем по приоритету, ротация одного приоритета через время
  const now = Date.now()
  const rotationSeed = Math.floor(now / (1000 * 60 * 30)) // меняется каждые 30 минут
  advices.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    // Ротация: стабильный порядок в пределах одного приоритета, меняется каждые 30 мин
    const hashA = (a.title.length * 31 + rotationSeed) % 1000
    const hashB = (b.title.length * 31 + rotationSeed) % 1000
    return hashA - hashB
  })

  // Возвращаем до 3 советов
  const result = advices.slice(0, 3)

  return result.length > 0
    ? result
    : [{
        emoji: '👋',
        title: t('welcome.title'),
        text: t('welcome.text'),
        priority: 0
      }]
}

// ========== Tag Analytics ==========

export interface TagInsight {
  tag: string
  avgSpeed: number
  sessionsCount: number
  diffPercent: number // vs overall average, positive = faster
  direction: 'up' | 'down' | 'neutral'
  text: string
}

export interface TagCombination {
  tags: string[]
  avgSymbols: number
  avgSpeed: number
  sessionsCount: number
}

export interface WeekComparison {
  thisWeekSymbols: number
  lastWeekSymbols: number
  diffPercent: number
  direction: 'up' | 'down' | 'same'
  text: string
}

export interface TagAnalytics {
  topInsights: TagInsight[]       // краткий блок: top-3
  allTags: TagInsight[]           // детальный блок: полная таблица
  combinations: TagCombination[]  // детальный блок: лучшие/худшие пары
  weekComparison: WeekComparison | null
  dailyFact: string | null
  sparklineData: number[]         // детальный блок: символы за 7 недель
  recentTrend: string | null      // детальный блок: последние 3 дня против среднего
}

export async function getTagAnalytics(
  selectedProjectId?: string
): Promise<TagAnalytics> {
  const sessions = await getSessions()
  const entries = await getEntries()

  const filteredSessions = selectedProjectId && selectedProjectId !== 'all'
    ? sessions.filter(s => s.projectId === selectedProjectId)
    : sessions
  const filteredEntries = selectedProjectId && selectedProjectId !== 'all'
    ? entries.filter(e => e.projectId === selectedProjectId)
    : entries

  // --- Tag productivity analysis ---
  const tagMap = new Map<string, { totalSpeed: number; totalSymbols: number; count: number }>()
  const sessionsWithTags = filteredSessions.filter(s => {
    const tags = getSessionTags(s)
    return tags.length > 0 && s.duration > 0
  })

  sessionsWithTags.forEach(s => {
    const speed = s.symbols / s.duration
    const tags = getSessionTags(s)
    tags.forEach(tag => {
      const cur = tagMap.get(tag) || { totalSpeed: 0, totalSymbols: 0, count: 0 }
      tagMap.set(tag, {
        totalSpeed: cur.totalSpeed + speed,
        totalSymbols: cur.totalSymbols + s.symbols,
        count: cur.count + 1
      })
    })
  })

  const overallAvgSpeed = sessionsWithTags.length > 0
    ? sessionsWithTags.reduce((s, se) => s + se.symbols / se.duration, 0) / sessionsWithTags.length
    : 0

  const allTags: TagInsight[] = Array.from(tagMap.entries())
    .filter(([_, stats]) => stats.count >= 3)
    .map(([tag, stats]) => {
      const avgSpeed = stats.totalSpeed / stats.count
      const diffPercent = overallAvgSpeed > 0 ? Math.round(((avgSpeed - overallAvgSpeed) / overallAvgSpeed) * 100) : 0
      const absDiff = Math.abs(diffPercent)
      const direction: 'up' | 'down' | 'neutral' = absDiff < 10 ? 'neutral' : diffPercent > 0 ? 'up' : 'down'

      let text: string
      if (direction === 'up') {
        text = t('tags.tagFaster', { tag, percent: absDiff })
      } else if (direction === 'down') {
        text = t('tags.tagSlower', { tag, percent: absDiff })
      } else {
        text = t('tags.tagNeutral', { tag })
      }

      return { tag, avgSpeed, sessionsCount: stats.count, diffPercent, direction, text }
    })
    .sort((a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent))

  // Top-3 insights (only meaningful ones)
  const topInsights = allTags.filter(t => t.direction !== 'neutral').slice(0, 3)

  // --- Tag combinations (детальный блок) ---
  const combMap = new Map<string, { totalSymbols: number; totalSpeed: number; count: number }>()
  sessionsWithTags.forEach(s => {
    const tags = getSessionTags(s)
    if (tags.length >= 2) {
      const speed = s.symbols / s.duration
      // Generate all pairs
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const key = [tags[i], tags[j]].sort().join('+')
          const cur = combMap.get(key) || { totalSymbols: 0, totalSpeed: 0, count: 0 }
          combMap.set(key, {
            totalSymbols: cur.totalSymbols + s.symbols,
            totalSpeed: cur.totalSpeed + speed,
            count: cur.count + 1
          })
        }
      }
    }
  })

  const combinations: TagCombination[] = Array.from(combMap.entries())
    .filter(([_, stats]) => stats.count >= 2)
    .map(([key, stats]) => ({
      tags: key.split('+'),
      avgSymbols: Math.round(stats.totalSymbols / stats.count),
      avgSpeed: Math.round((stats.totalSpeed / stats.count) * 10) / 10,
      sessionsCount: stats.count
    }))
    .sort((a, b) => b.avgSpeed - a.avgSpeed)

  // --- Week comparison ---
  const today = new Date()
  const thisWeekStart = format(subDays(today, today.getDay() || 7), 'yyyy-MM-dd')
  const lastWeekStart = format(subDays(today, (today.getDay() || 7) + 7), 'yyyy-MM-dd')

  const thisWeekSymbols = filteredEntries
    .filter(e => e.date >= thisWeekStart)
    .reduce((s, e) => s + e.symbols, 0)
  const lastWeekSymbols = filteredEntries
    .filter(e => e.date >= lastWeekStart && e.date < thisWeekStart)
    .reduce((s, e) => s + e.symbols, 0)

  let weekComparison: WeekComparison | null = null
  if (lastWeekSymbols > 0) {
    const diffPercent = Math.round(((thisWeekSymbols - lastWeekSymbols) / lastWeekSymbols) * 100)
    const direction: 'up' | 'down' | 'same' = Math.abs(diffPercent) < 5 ? 'same' : diffPercent > 0 ? 'up' : 'down'
    const text = direction === 'up'
      ? t('week.better', { percent: diffPercent })
      : direction === 'down'
        ? t('week.worse', { percent: Math.abs(diffPercent) })
        : t('week.same')
    weekComparison = { thisWeekSymbols, lastWeekSymbols, diffPercent, direction, text }
  }

  // --- Daily fact (rotates) ---
  const facts: string[] = []
  if (topInsights.length > 0) {
    topInsights.forEach(ins => facts.push(ins.text))
  }
  if (weekComparison) facts.push(weekComparison.text)

  const bestDow = analyzeBestDay(filteredEntries)
  if (bestDow) facts.push(t('facts.bestDay', { day: capitalize(bestDow) }))

  if (filteredSessions.length > 5) {
    const bestTime = analyzeBestTime(filteredSessions)
    if (bestTime) facts.push(t('facts.bestTime', { time: bestTime }))
  }

  const factIndex = facts.length > 0 ? Math.floor(Date.now() / (1000 * 60 * 15)) % facts.length : 0
  const dailyFact = facts.length > 0 ? facts[factIndex] : null

  // --- Sparkline: last 7 weeks ---
  const sparklineData: number[] = []
  for (let w = 6; w >= 0; w--) {
    const weekStart = format(subDays(today, (today.getDay() || 7) + w * 7), 'yyyy-MM-dd')
    const weekEnd = format(subDays(today, (today.getDay() || 7) + (w - 1) * 7), 'yyyy-MM-dd')
    const weekSymbols = filteredEntries
      .filter(e => e.date >= weekStart && e.date < weekEnd)
      .reduce((s, e) => s + e.symbols, 0)
    sparklineData.push(weekSymbols)
  }

  // --- Recent trend (last 3 days vs avg) ---
  let recentTrend: string | null = null
  const todayStr = format(today, 'yyyy-MM-dd')
  const threeDaysAgo = format(subDays(today, 3), 'yyyy-MM-dd')
  const recent3 = filteredEntries.filter(e => e.date >= threeDaysAgo && e.date <= todayStr)
  const recent3Total = recent3.reduce((s, e) => s + e.symbols, 0)
  const recent3Avg = recent3Total / 3

  const allDays = new Set(filteredEntries.map(e => e.date)).size
  const overallAvg = allDays > 0 ? filteredEntries.reduce((s, e) => s + e.symbols, 0) / allDays : 0

  if (overallAvg > 0 && allDays >= 7) {
    const diff = Math.round(((recent3Avg - overallAvg) / overallAvg) * 100)
    if (Math.abs(diff) >= 10) {
      recentTrend = diff > 0
        ? t('recentTrend.more', { percent: diff })
        : t('recentTrend.less', { percent: Math.abs(diff) })
    }
  }

  return {
    topInsights,
    allTags,
    combinations,
    weekComparison,
    dailyFact,
    sparklineData,
    recentTrend
  }
}

// ========== Daily Plan ==========

export interface DailyPlan {
  targetSymbols: number
  writtenToday: number
  progress: number // 0-100
  completed: boolean
  source: 'deadline' | 'average' | 'default'
  message: string
}

export async function getDailyPlan(
  selectedProjectId?: string
): Promise<DailyPlan> {
  const entries = await getEntries()
  const projects = await getProjects()

  const today = new Date()
  const todayStr = toLocalDateString(today)
  const currentDow = today.getDay() // 0=Sun

  // Символы за сегодня (по выбранному проекту или всего)
  const todayEntries = selectedProjectId && selectedProjectId !== 'all'
    ? entries.filter(e => e.date === todayStr && e.projectId === selectedProjectId)
    : entries.filter(e => e.date === todayStr)
  const writtenToday = todayEntries.reduce((s, e) => s + e.symbols, 0)

  // Попробуем вычислить план по дедлайну
  const activeProject = selectedProjectId && selectedProjectId !== 'all'
    ? projects.find(p => p.id === selectedProjectId && p.status === 'active')
    : null

  if (activeProject?.deadline) {
    const daysLeft = differenceInDays(new Date(activeProject.deadline), today)
    if (daysLeft > 0) {
      const projectEntries = entries.filter(e => e.projectId === activeProject.id)
      const totalWritten = projectEntries.reduce((s, e) => s + e.symbols, 0)
      const remaining = Math.max(activeProject.targetSymbols - totalWritten, 0)
      const targetSymbols = Math.ceil(remaining / daysLeft)

      if (targetSymbols > 0) {
        const progress = Math.min(Math.round((writtenToday / targetSymbols) * 100), 100)
        const completed = writtenToday >= targetSymbols
        return {
          targetSymbols,
          writtenToday,
          progress,
          completed,
          source: 'deadline',
          message: completed
            ? t('dailyPlan.done')
            : t('dailyPlan.remaining', { symbols: formatNumber((targetSymbols - writtenToday)) })
        }
      }
    }
  }

  // План по среднему темпу за 14 дней
  const twoWeeksAgo = new Date(today)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const twoWeeksStr = toLocalDateString(twoWeeksAgo)

  const recentEntries = selectedProjectId && selectedProjectId !== 'all'
    ? entries.filter(e => e.date >= twoWeeksStr && e.date < todayStr && e.projectId === selectedProjectId)
    : entries.filter(e => e.date >= twoWeeksStr && e.date < todayStr)

  if (recentEntries.length >= 3) {
    // Считаем средний темп с учётом дня недели
    const dowEntries = recentEntries.filter(e => new Date(e.date).getDay() === currentDow)
    const avgSource = dowEntries.length >= 2 ? dowEntries : recentEntries

    const totalRecent = avgSource.reduce((s, e) => s + e.symbols, 0)
    const uniqueDays = new Set(avgSource.map(e => e.date)).size
    const targetSymbols = uniqueDays > 0 ? Math.round(totalRecent / uniqueDays) : 500

    const progress = Math.min(Math.round((writtenToday / targetSymbols) * 100), 100)
    const completed = writtenToday >= targetSymbols
    return {
      targetSymbols,
      writtenToday,
      progress,
      completed,
      source: 'average',
      message: completed
        ? t('dailyPlan.done')
        : t('dailyPlan.remaining', { symbols: formatNumber((targetSymbols - writtenToday)) })
    }
  }

  // Дефолт — 500 символов
  const defaultTarget = 500
  const progress = Math.min(Math.round((writtenToday / defaultTarget) * 100), 100)
  return {
    targetSymbols: defaultTarget,
    writtenToday,
    progress,
    completed: writtenToday >= defaultTarget,
    source: 'default',
    message: writtenToday >= defaultTarget
      ? t('dailyPlan.done')
      : t('dailyPlan.remaining', { symbols: formatNumber((defaultTarget - writtenToday)) })
  }
}

// ========== Project Forecast ==========

export interface ProjectForecast {
  projectTitle: string
  avgSpeed: number
  daysNeeded: number
  projectedFinish: Date | null
  daysAhead: number
  status: 'ahead' | 'ontrack' | 'behind' | 'nodata'
  emoji: string
  title: string
  message: string
  progress: number // 0-100
  totalWritten: number
  targetSymbols: number
}


// ========== Общее ядро прогноза ==========
// Единственная реализация математики прогноза: использует и ассистент,
// и карточка проекта (раньше были две копии с риском расхождения — A9).

export interface ForecastCore {
  avgSpeed: number
  daysNeeded: number
  projectedFinish: Date | null
  daysAhead: number
  status: 'ahead' | 'ontrack' | 'behind' | 'nodata'
  totalWritten: number
  progress: number
}

/** Считает прогноз финиша проекта по его записям (скорость — среднее за 14 дней). */
export function computeForecastCore(
  project: { targetSymbols: number; deadline: string },
  projectEntries: Array<{ date: string; symbols: number }>
): ForecastCore {
  const totalWritten = projectEntries.reduce((s, e) => s + e.symbols, 0)
  const progress = project.targetSymbols > 0
    ? Math.min(Math.round((totalWritten / project.targetSymbols) * 100), 100)
    : 0

  const today = new Date()
  const fourteenStr = format(subDays(today, 14), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')
  const recentEntries = projectEntries.filter(e => e.date >= fourteenStr && e.date <= todayStr)

  let avgSpeed = 0
  if (recentEntries.length < 3) {
    // Мало данных — считаем по активным дням, чтобы не занижать скорость
    const uniqueDays = new Set(recentEntries.map(e => e.date)).size
    avgSpeed = uniqueDays > 0 ? Math.round(recentEntries.reduce((s, e) => s + e.symbols, 0) / uniqueDays) : 0
  } else {
    avgSpeed = Math.round(recentEntries.reduce((s, e) => s + e.symbols, 0) / 14)
  }

  if (avgSpeed === 0) {
    return { avgSpeed: 0, daysNeeded: 0, projectedFinish: null, daysAhead: 0, status: 'nodata', totalWritten, progress }
  }

  const remaining = project.targetSymbols - totalWritten
  const daysNeeded = Math.ceil(remaining / avgSpeed)
  const projectedFinish = new Date(today.getTime() + daysNeeded * 86400000)
  const daysUntilDeadline = differenceInDays(new Date(project.deadline), today)
  const daysAhead = daysUntilDeadline - daysNeeded

  let status: 'ahead' | 'ontrack' | 'behind' = 'ontrack'
  if (daysAhead > 7) status = 'ahead'
  else if (daysAhead < -7) status = 'behind'

  return { avgSpeed, daysNeeded, projectedFinish, daysAhead, status, totalWritten, progress }
}

export async function getProjectForecast(
  selectedProjectId?: string
): Promise<ProjectForecast | null> {
  const entries = await getEntries()
  const projects = await getProjects()

  const activeProjects = projects.filter(p => p.status === 'active')
  if (activeProjects.length === 0) return null

  // Pick project: selected or first active
  const project = selectedProjectId && selectedProjectId !== 'all'
    ? activeProjects.find(p => p.id === selectedProjectId)
    : activeProjects[0]

  if (!project) return null
  if (!project.targetSymbols || !project.deadline) return null

  const projectEntries = entries.filter(e => e.projectId === project.id)
  const core = computeForecastCore(project, projectEntries)
  const { avgSpeed, daysNeeded, projectedFinish, daysAhead, totalWritten, progress } = core

  if (projectEntries.length === 0) {
    return {
      projectTitle: project.title,
      avgSpeed: 0, daysNeeded: 0, projectedFinish: null, daysAhead: 0,
      status: 'nodata', emoji: '📝', title: t('forecast.startWritingTitle'),
      message: t('forecast.startWritingMessage'),
      progress, totalWritten, targetSymbols: project.targetSymbols
    }
  }

  if (core.status === 'nodata') {
    return {
      projectTitle: project.title,
      avgSpeed: 0, daysNeeded: 0, projectedFinish: null, daysAhead: 0,
      status: 'nodata', emoji: '📊', title: t('forecast.collectingTitle'),
      message: t('forecast.collectingMessage', { written: formatNumber(totalWritten), target: formatNumber(project.targetSymbols) }),
      progress, totalWritten, targetSymbols: project.targetSymbols
    }
  }

  const status = core.status
  const remaining = project.targetSymbols - totalWritten
  const daysUntilDeadline = differenceInDays(new Date(project.deadline), new Date())
  const neededSpeed = Math.ceil(remaining / Math.max(1, daysUntilDeadline))

  let emoji: string, title: string, message: string
  if (status === 'ahead') {
    const relaxedSpeed = Math.round(avgSpeed * 0.8)
    emoji = '🚀'
    title = t('forecast.aheadTitle')
    message = t('forecast.aheadMessage', { speed: formatNumber(avgSpeed), days: daysNeeded, ahead: Math.abs(daysAhead), relaxed: formatNumber(relaxedSpeed) })
  } else if (status === 'behind') {
    emoji = '⚠️'
    title = t('forecast.behindTitle')
    message = t('forecast.behindMessage', { speed: formatNumber(avgSpeed), days: daysNeeded, ahead: Math.abs(daysAhead), needed: formatNumber(neededSpeed) })
  } else {
    emoji = '🎯'
    title = t('forecast.ontrackTitle')
    message = t('forecast.ontrackMessage', { speed: formatNumber(avgSpeed), days: daysNeeded })
  }

  return {
    projectTitle: project.title,
    avgSpeed, daysNeeded, projectedFinish, daysAhead,
    status, emoji, title, message,
    progress, totalWritten, targetSymbols: project.targetSymbols
  }
}

// ========== Personal Recommendations ==========

export interface TimeSlotStats {
  label: string
  sessions: number
  avgSymbols: number
  avgSpeed: number
}

export interface DurationBucket {
  label: string
  range: string
  sessions: number
  avgSymbols: number
  avgSpeed: number
}

export interface BreakPattern {
  avgStreakBeforeBreak: number
  avgRecoveryBoost: number // % change after break
  text: string
}

export interface PersonalRecommendations {
  // краткий блок: 1-2 текстовые рекомендации
  topRecs: Array<{ emoji: string; text: string }>
  // детальный блок: разбивки по времени/длительности
  timeSlots: TimeSlotStats[]
  durationBuckets: DurationBucket[]
  breakPattern: BreakPattern | null
  dailyRec: string | null // "Today is Wednesday, try a morning 25-min session with #coffee"
}

export async function getPersonalRecommendations(
  selectedProjectId?: string
): Promise<PersonalRecommendations> {
  const sessions = await getSessions()
  const entries = await getEntries()

  const filteredSessions = selectedProjectId && selectedProjectId !== 'all'
    ? sessions.filter(s => s.projectId === selectedProjectId)
    : sessions
  const filteredEntries = selectedProjectId && selectedProjectId !== 'all'
    ? entries.filter(e => e.projectId === selectedProjectId)
    : entries

  const validSessions = filteredSessions.filter(s => s.duration > 0 && s.symbols > 0)

  // --- Time of day analysis ---
  const slots: Record<string, { totalSymbols: number; totalSpeed: number; count: number }> = {
    morning: { totalSymbols: 0, totalSpeed: 0, count: 0 },
    afternoon: { totalSymbols: 0, totalSpeed: 0, count: 0 },
    evening: { totalSymbols: 0, totalSpeed: 0, count: 0 },
    night: { totalSymbols: 0, totalSpeed: 0, count: 0 }
  }
  const slotLabels: Record<string, string> = {
    morning: t('timeSlotLabels.morning'),
    afternoon: t('timeSlotLabels.afternoon'),
    evening: t('timeSlotLabels.evening'),
    night: t('timeSlotLabels.night')
  }

  validSessions.forEach(s => {
    try {
      const hour = new Date(s.date).getHours()
      const speed = s.symbols / s.duration
      let slot: string
      if (hour >= 6 && hour < 12) slot = 'morning'
      else if (hour >= 12 && hour < 18) slot = 'afternoon'
      else if (hour >= 18 && hour < 22) slot = 'evening'
      else slot = 'night'

      slots[slot].totalSymbols += s.symbols
      slots[slot].totalSpeed += speed
      slots[slot].count++
    } catch {
      // ignore
    }
  })

  const timeSlots: TimeSlotStats[] = Object.entries(slots)
    .filter(([_, s]) => s.count > 0)
    .map(([key, s]) => ({
      label: slotLabels[key],
      sessions: s.count,
      avgSymbols: Math.round(s.totalSymbols / s.count),
      avgSpeed: Math.round((s.totalSpeed / s.count) * 10) / 10
    }))
    .sort((a, b) => b.avgSpeed - a.avgSpeed)

  // --- Duration buckets ---
  const buckets: Array<{ label: string; range: string; min: number; max: number; totalSymbols: number; totalSpeed: number; count: number }> = [
    { label: t('durationLabels.short'), range: t('durationRanges.short'), min: 5, max: 15, totalSymbols: 0, totalSpeed: 0, count: 0 },
    { label: t('durationLabels.medium'), range: t('durationRanges.medium'), min: 15, max: 30, totalSymbols: 0, totalSpeed: 0, count: 0 },
    { label: t('durationLabels.long'), range: t('durationRanges.long'), min: 30, max: 60, totalSymbols: 0, totalSpeed: 0, count: 0 },
    { label: t('durationLabels.marathon'), range: t('durationRanges.marathon'), min: 60, max: Infinity, totalSymbols: 0, totalSpeed: 0, count: 0 }
  ]

  validSessions.forEach(s => {
    const speed = s.symbols / s.duration
    for (const b of buckets) {
      if (s.duration >= b.min && s.duration < b.max) {
        b.totalSymbols += s.symbols
        b.totalSpeed += speed
        b.count++
        break
      }
    }
  })

  const durationBuckets: DurationBucket[] = buckets
    .filter(b => b.count > 0)
    .map(b => ({
      label: b.label,
      range: b.range,
      sessions: b.count,
      avgSymbols: Math.round(b.totalSymbols / b.count),
      avgSpeed: Math.round((b.totalSpeed / b.count) * 10) / 10
    }))

  // --- Break pattern analysis ---
  let breakPattern: BreakPattern | null = null
  if (filteredEntries.length >= 14) {
    const sortedDates = [...new Set(filteredEntries.map(e => e.date))].sort()
    const streakLengths: number[] = []
    let currentStreak = 1

    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1])
      const curr = new Date(sortedDates[i])
      const diff = differenceInDays(curr, prev)
      if (diff === 1) {
        currentStreak++
      } else {
        if (currentStreak > 1) streakLengths.push(currentStreak)
        currentStreak = 1
      }
    }
    if (currentStreak > 1) streakLengths.push(currentStreak)

    if (streakLengths.length >= 2) {
      const avgStreak = Math.round(streakLengths.reduce((s, v) => s + v, 0) / streakLengths.length)

      // After-break recovery: compare avg symbols of first 3 days after break vs overall
      const dateSymbols = new Map<string, number>()
      filteredEntries.forEach(e => {
        dateSymbols.set(e.date, (dateSymbols.get(e.date) || 0) + e.symbols)
      })
      const allDatesArr = [...dateSymbols.keys()].sort()
      let afterBreakTotal = 0
      let afterBreakDays = 0

      for (let i = 1; i < allDatesArr.length; i++) {
        const diff = differenceInDays(new Date(allDatesArr[i]), new Date(allDatesArr[i - 1]))
        if (diff >= 2) {
          // This is a return after break — take up to 3 days
          for (let d = 0; d < 3 && i + d < allDatesArr.length; d++) {
            const sym = dateSymbols.get(allDatesArr[i + d]) || 0
            afterBreakTotal += sym
            afterBreakDays++
          }
        }
      }

      const overallAvgDay = filteredEntries.reduce((s, e) => s + e.symbols, 0) / new Set(filteredEntries.map(e => e.date)).size
      const afterBreakAvg = afterBreakDays > 0 ? afterBreakTotal / afterBreakDays : 0
      const recoveryBoost = overallAvgDay > 0 ? Math.round(((afterBreakAvg - overallAvgDay) / overallAvgDay) * 100) : 0

      let text: string
      if (recoveryBoost > 5) {
        text = t('breakPattern.boost', { days: avgStreak, percent: recoveryBoost })
      } else if (recoveryBoost < -5) {
        text = t('breakPattern.slower', { days: avgStreak, percent: Math.abs(recoveryBoost) })
      } else {
        text = t('breakPattern.normal', { days: avgStreak })
      }

      breakPattern = { avgStreakBeforeBreak: avgStreak, avgRecoveryBoost: recoveryBoost, text }
    }
  }

  // --- Краткие рекомендации (1-2 текста) ---
  const topRecs: Array<{ emoji: string; text: string }> = []

  // Best time recommendation
  if (timeSlots.length >= 2) {
    const best = timeSlots[0]
    topRecs.push({
      emoji: '⏰',
      text: t('recommendations.bestTime', { label: best.label.toLowerCase(), speed: best.avgSpeed })
    })
  }

  // Best duration recommendation
  if (durationBuckets.length >= 2) {
    const bestDur = [...durationBuckets].sort((a, b) => b.avgSpeed - a.avgSpeed)[0]
    topRecs.push({
      emoji: '⏱️',
      text: t('recommendations.bestDuration', { range: bestDur.range.toLowerCase(), speed: bestDur.avgSpeed })
    })
  }

  // --- Daily recommendation ---
  let dailyRec: string | null = null
  const today = new Date()
  const todayName = weekdayName(today.getDay())

  if (timeSlots.length > 0 && durationBuckets.length > 0) {
    const bestTime = timeSlots[0].label.toLowerCase()
    const bestDur = [...durationBuckets].sort((a, b) => b.avgSpeed - a.avgSpeed)[0]

    // Find best tag
    const tagMap = new Map<string, { totalSpeed: number; count: number }>()
    validSessions.forEach(s => {
      const tags = getSessionTags(s)
      const speed = s.symbols / s.duration
      tags.forEach(tag => {
        const cur = tagMap.get(tag) || { totalSpeed: 0, count: 0 }
        tagMap.set(tag, { totalSpeed: cur.totalSpeed + speed, count: cur.count + 1 })
      })
    })
    const bestTag = Array.from(tagMap.entries())
      .filter(([_, s]) => s.count >= 2)
      .sort((a, b) => (b[1].totalSpeed / b[1].count) - (a[1].totalSpeed / a[1].count))
      .map(([tag]) => tag)[0]

    dailyRec = t('recommendations.daily', {
      day: todayName,
      range: bestDur.range.toLowerCase(),
      time: bestTime,
      tag: bestTag ? t('recommendations.dailyTag', { tag: bestTag }) : ''
    })
  }

  return { topRecs, timeSlots, durationBuckets, breakPattern, dailyRec }
}

// Обратная совместимость — возвращает 1 лучший совет
export async function getBestAdvice(
  totalSymbols: number,
  entriesCount: number,
  streak: number,
  last7DaysSymbols: number,
  selectedProjectId?: string
): Promise<AssistantAdvice> {
  const advices = await getAdvices(totalSymbols, entriesCount, streak, last7DaysSymbols, selectedProjectId)
  return advices[0]
}
