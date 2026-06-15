import { getEntries, getSessions, getSetting, setSetting } from './databaseService'
import { getSessionTags } from '../config/appConfig'
import { format, subDays } from 'date-fns'
import i18n from '../i18n'
import { formatNumber } from '../i18n/dateLocale'
import { parseLocalDate } from '../utils/dates'

/** Перевод строки из namespace `assistant`. */
const t = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(key, { ns: 'assistant', ...opts }) as string

// ========== Types ==========

export type GoalType = 'daily_symbols' | 'streak_days' | 'try_time' | 'beat_record'

export interface Goal {
  id: string
  type: GoalType
  title: string
  emoji: string
  description: string
  target: number
  current: number
  completed: boolean
  completedAt?: string
  createdAt: string
  expiresAt?: string // for daily goals
}

interface GoalState {
  goals: Goal[]
  lastGeneratedDate: string
  dismissedGoalIds: string[]
}

const STORAGE_KEY = 'knigotrek_goals'

// ========== Storage ==========

async function loadState(): Promise<GoalState> {
  try {
    // Основное хранилище — settings (SQLite в Electron, попадает в бэкапы);
    // старый localStorage-ключ читаем как fallback для миграции
    const raw = (await getSetting(STORAGE_KEY)) ?? localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { goals: [], lastGeneratedDate: '', dismissedGoalIds: [] }
}

async function saveState(state: GoalState): Promise<void> {
  await setSetting(STORAGE_KEY, JSON.stringify(state))
}

// ========== Goal Generation ==========

export async function getActiveGoals(selectedProjectId?: string): Promise<Goal[]> {
  const state = await loadState()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Remove expired goals (daily goals that are past their date and not completed)
  state.goals = state.goals.filter(g =>
    g.completed || !g.expiresAt || g.expiresAt >= today
  )

  // Generate new goals if needed (once per day)
  if (state.lastGeneratedDate !== today) {
    const newGoals = await generateGoals(state, selectedProjectId)
    // Keep completed goals from today for celebration display, add new ones
    const activeGoals = state.goals.filter(g => g.completed && g.completedAt === today)
    state.goals = [...activeGoals, ...newGoals].slice(0, 3)
    state.lastGeneratedDate = today
    await saveState(state)
  }

  return state.goals.filter(g => !state.dismissedGoalIds.includes(g.id))
}

export async function markGoalCompleted(goalId: string): Promise<void> {
  const state = await loadState()
  const goal = state.goals.find(g => g.id === goalId)
  if (goal && !goal.completed) {
    goal.completed = true
    goal.completedAt = format(new Date(), 'yyyy-MM-dd')
    await saveState(state)
  }
}

export async function dismissGoal(goalId: string): Promise<void> {
  const state = await loadState()
  state.dismissedGoalIds.push(goalId)
  await saveState(state)
}

async function generateGoals(_state: GoalState, selectedProjectId?: string): Promise<Goal[]> {
  const entries = await getEntries()
  const sessions = await getSessions()

  const filteredEntries = selectedProjectId && selectedProjectId !== 'all'
    ? entries.filter(e => e.projectId === selectedProjectId)
    : entries
  const filteredSessions = selectedProjectId && selectedProjectId !== 'all'
    ? sessions.filter(s => s.projectId === selectedProjectId)
    : sessions

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const goals: Goal[] = []

  // Compute stats
  const todayEntries = filteredEntries.filter(e => e.date === todayStr)
  const todaySymbols = todayEntries.reduce((s, e) => s + e.symbols, 0)

  const sortedDates = [...new Set(filteredEntries.map(e => e.date))].sort()
  let streak = 0
  if (sortedDates.length > 0) {
    const yesterday = format(subDays(today, 1), 'yyyy-MM-dd')
    // If we have an entry today, start from today, else from yesterday
    if (!sortedDates.includes(todayStr)) {
      if (!sortedDates.includes(yesterday)) {
        streak = 0
      } else {
        streak = 1
        let d = subDays(parseLocalDate(yesterday), 1)
        while (sortedDates.includes(format(d, 'yyyy-MM-dd'))) {
          streak++
          d = subDays(d, 1)
        }
      }
    } else {
      streak = 1
      let d = subDays(today, 1)
      while (sortedDates.includes(format(d, 'yyyy-MM-dd'))) {
        streak++
        d = subDays(d, 1)
      }
    }
  }

  // Average daily symbols (last 14 days)
  const twoWeeksAgo = format(subDays(today, 14), 'yyyy-MM-dd')
  const recentEntries = filteredEntries.filter(e => e.date >= twoWeeksAgo && e.date < todayStr)
  const recentDays = new Set(recentEntries.map(e => e.date)).size
  const avgDaily = recentDays > 0 ? Math.round(recentEntries.reduce((s, e) => s + e.symbols, 0) / recentDays) : 0

  // Used tags
  const usedTags = new Set<string>()
  filteredSessions.forEach(s => {
    getSessionTags(s).forEach(t => usedTags.add(t))
  })

  // Sessions by time of day
  const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  filteredSessions.forEach(s => {
    try {
      const hour = new Date(s.date).getHours()
      if (hour >= 6 && hour < 12) timeSlots.morning++
      else if (hour >= 12 && hour < 18) timeSlots.afternoon++
      else if (hour >= 18 && hour < 22) timeSlots.evening++
      else timeSlots.night++
    } catch { /* ignore */ }
  })

  // Best daily record
  const daySymbols = new Map<string, number>()
  filteredEntries.forEach(e => {
    daySymbols.set(e.date, (daySymbols.get(e.date) || 0) + e.symbols)
  })
  const bestDay = daySymbols.size > 0 ? Math.max(...daySymbols.values()) : 0

  // === Goal 1: Daily symbols target ===
  if (streak === 0 && avgDaily === 0) {
    // Brand new user
    goals.push({
      id: `daily_${todayStr}`,
      type: 'daily_symbols',
      title: t('goals.firstStepTitle'),
      emoji: '🎯',
      description: t('goals.firstStepDesc'),
      target: 100,
      current: todaySymbols,
      completed: todaySymbols >= 100,
      createdAt: todayStr,
      expiresAt: todayStr
    })
  } else if (avgDaily > 0) {
    // Challenge: 10-20% above average
    const challengeTarget = Math.round(avgDaily * 1.15 / 50) * 50 // round to nearest 50
    goals.push({
      id: `daily_${todayStr}`,
      type: 'daily_symbols',
      title: t('goals.dailyChallengeTitle'),
      emoji: '🎯',
      description: t('goals.dailyChallengeDesc', { value: formatNumber(challengeTarget) }),
      target: challengeTarget,
      current: todaySymbols,
      completed: todaySymbols >= challengeTarget,
      createdAt: todayStr,
      expiresAt: todayStr
    })
  }

  // === Goal 2: Streak-based ===
  if (streak === 0) {
    goals.push({
      id: `streak_start_${todayStr}`,
      type: 'streak_days',
      title: t('goals.startStreakTitle'),
      emoji: '🔥',
      description: t('goals.startStreakDesc'),
      target: 1,
      current: todaySymbols > 0 ? 1 : 0,
      completed: todaySymbols > 0,
      createdAt: todayStr,
      expiresAt: todayStr
    })
  } else if (streak > 0 && streak < 7) {
    const daysToWeek = 7 - streak
    goals.push({
      id: `streak_week_${todayStr}`,
      type: 'streak_days',
      title: t('goals.streakWeekTitle', { count: daysToWeek }),
      emoji: '🔥',
      description: t('goals.streakWeekDesc'),
      target: 7,
      current: streak,
      completed: false,
      createdAt: todayStr
    })
  } else if (streak >= 7 && streak < 21) {
    goals.push({
      id: `streak_habit_${todayStr}`,
      type: 'streak_days',
      title: t('goals.habitTitle'),
      emoji: '💪',
      description: t('goals.habitDesc', { streak }),
      target: 21,
      current: streak,
      completed: false,
      createdAt: todayStr
    })
  } else if (streak >= 21 && streak < 30) {
    goals.push({
      id: `streak_month_${todayStr}`,
      type: 'streak_days',
      title: t('goals.monthTitle'),
      emoji: '⭐',
      description: t('goals.monthDesc', { streak, left: 30 - streak }),
      target: 30,
      current: streak,
      completed: false,
      createdAt: todayStr
    })
  }

  // === Goal 3: Exploration (try new tag or time) ===
  const totalSlots = Object.values(timeSlots).reduce((s, v) => s + v, 0)
  const unusedSlots: string[] = []
  if (timeSlots.morning === 0 && totalSlots > 3) unusedSlots.push(t('goals.slotMorning'))
  if (timeSlots.afternoon === 0 && totalSlots > 3) unusedSlots.push(t('goals.slotAfternoon'))
  if (timeSlots.evening === 0 && totalSlots > 3) unusedSlots.push(t('goals.slotEvening'))

  if (unusedSlots.length > 0 && goals.length < 3) {
    const slot = unusedSlots[Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % unusedSlots.length]
    goals.push({
      id: `try_time_${todayStr}`,
      type: 'try_time',
      title: t('goals.exploreTitle'),
      emoji: '🧭',
      description: t('goals.exploreDesc', { slot }),
      target: 1,
      current: 0,
      completed: false,
      createdAt: todayStr,
      expiresAt: todayStr
    })
  }

  // Beat personal record
  if (bestDay > 0 && avgDaily > 0 && goals.length < 3) {
    const nearRecord = bestDay - todaySymbols
    if (nearRecord > 0 && nearRecord < avgDaily * 2) {
      goals.push({
        id: `beat_record_${todayStr}`,
        type: 'beat_record',
        title: t('goals.beatRecordTitle'),
        emoji: '🏆',
        description: t('goals.beatRecordDesc', { record: formatNumber(bestDay), left: formatNumber(nearRecord) }),
        target: bestDay,
        current: todaySymbols,
        completed: todaySymbols >= bestDay,
        createdAt: todayStr,
        expiresAt: todayStr
      })
    }
  }

  return goals.slice(0, 3)
}

// ========== Update goals with current data ==========

export async function refreshGoalProgress(selectedProjectId?: string): Promise<Goal[]> {
  const state = await loadState()
  const entries = await getEntries()

  const filteredEntries = selectedProjectId && selectedProjectId !== 'all'
    ? entries.filter(e => e.projectId === selectedProjectId)
    : entries

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const todaySymbols = filteredEntries
    .filter(e => e.date === todayStr)
    .reduce((s, e) => s + e.symbols, 0)

  let changed = false
  for (const goal of state.goals) {
    if (goal.completed) continue

    if (goal.type === 'daily_symbols' || goal.type === 'beat_record') {
      goal.current = todaySymbols
      if (todaySymbols >= goal.target) {
        goal.completed = true
        goal.completedAt = todayStr
        changed = true
      }
    } else if (goal.type === 'streak_days' && goal.id.startsWith('streak_start')) {
      goal.current = todaySymbols > 0 ? 1 : 0
      if (todaySymbols > 0) {
        goal.completed = true
        goal.completedAt = todayStr
        changed = true
      }
    }
    // streak_days (week/habit/month) — streak updates on next day, not real-time
  }

  if (changed) await saveState(state)
  return state.goals.filter(g => !state.dismissedGoalIds.includes(g.id))
}
