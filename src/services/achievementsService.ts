// Сервис достижений: чистое ядро (расчёт статистики и разблокировок) + персистентность.
//
// Достижения хранятся в settings-ключе `achievements_state` (вариант A — без миграций
// схемы, работает и в Electron-SQLite, и в localStorage браузера). Разблокировка
// необратима: один раз открытое остаётся открытым, даже если стрик потом прервётся.
//
// Чистые функции (computeStats / evaluateAuto / buildViews) не зависят от БД и i18n —
// их легко покрыть юнит-тестами.

import { ACHIEVEMENTS, type AchievementDef, type AchievementMetric } from '../data/achievements'
import { parseLocalDate } from '../utils/dates'
import { getEntries, getProjects, getChapters, getSessions, getSetting, setSetting } from './databaseService'

export interface AchievementStats {
  totalSymbols: number
  longestStreak: number
  activeDays: number
  focusMinutes: number
  totalSessions: number
  chaptersDone: number
  completedProjects: number
  maxSessionSymbols: number
  maxDaySymbols: number
  maxSessionMinutes: number
}

interface EntryLike { date: string; symbols: number }
interface SessionLike { duration: number; symbols: number }
interface ProjectLike { status?: string }
interface ChapterLike { status?: string }

const DAY_MS = 86_400_000

/** Самая длинная серия подряд идущих дат среди активных дней. */
function computeLongestStreak(activeDates: string[]): number {
  if (activeDates.length === 0) return 0
  const days = [...new Set(activeDates)]
    .map((d) => parseLocalDate(d).getTime())
    .sort((a, b) => a - b)
  let longest = 1
  let current = 1
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i] - days[i - 1]) / DAY_MS)
    if (diff === 1) current++
    else if (diff > 1) current = 1
    if (current > longest) longest = current
  }
  return longest
}

/** Чистый расчёт всех метрик достижений из сырых данных. */
export function computeStats(
  entries: EntryLike[],
  sessions: SessionLike[],
  projects: ProjectLike[],
  chapters: ChapterLike[],
): AchievementStats {
  const totalSymbols = entries.reduce((s, e) => s + (e.symbols || 0), 0)

  // Сумма символов по дню (на дату может быть несколько записей — по проекту)
  const byDay = new Map<string, number>()
  for (const e of entries) {
    if (!e.date) continue
    byDay.set(e.date, (byDay.get(e.date) || 0) + (e.symbols || 0))
  }
  const activeDates = [...byDay.entries()].filter(([, v]) => v > 0).map(([d]) => d)
  const maxDaySymbols = byDay.size ? Math.max(0, ...byDay.values()) : 0

  return {
    totalSymbols,
    longestStreak: computeLongestStreak(activeDates),
    activeDays: activeDates.length,
    focusMinutes: sessions.reduce((s, x) => s + (x.duration || 0), 0),
    totalSessions: sessions.length,
    chaptersDone: chapters.filter((c) => c.status === 'done').length,
    completedProjects: projects.filter((p) => p.status === 'completed').length,
    maxSessionSymbols: sessions.length ? Math.max(0, ...sessions.map((s) => s.symbols || 0)) : 0,
    maxDaySymbols,
    maxSessionMinutes: sessions.length ? Math.max(0, ...sessions.map((s) => s.duration || 0)) : 0,
  }
}

/** id достижений, чьи пороги достигнуты при текущей статистике. */
export function evaluateAuto(stats: AchievementStats): string[] {
  return ACHIEVEMENTS
    .filter((a) => (stats[a.metric as AchievementMetric] ?? 0) >= a.threshold)
    .map((a) => a.id)
}

export interface AchievementView extends AchievementDef {
  unlocked: boolean
  /** Текущее значение метрики. */
  current: number
  /** Прогресс к порогу этого достижения, 0..1. */
  progress: number
}

/** Готовит данные для UI: для каждого достижения — открыто ли, текущее значение и прогресс. */
export function buildViews(stats: AchievementStats, unlockedIds: Set<string>): AchievementView[] {
  return ACHIEVEMENTS.map((a) => {
    const current = stats[a.metric as AchievementMetric] ?? 0
    const unlocked = unlockedIds.has(a.id) || current >= a.threshold
    const progress = a.threshold > 0 ? Math.min(1, current / a.threshold) : unlocked ? 1 : 0
    return { ...a, unlocked, current, progress }
  })
}

// ---------- Персистентность ----------

const STATE_KEY = 'achievements_state'

interface UnlockedRecord {
  at: string
  manual?: boolean
}

export interface AchievementState {
  initialized: boolean
  unlocked: Record<string, UnlockedRecord>
}

export async function loadAchievementState(): Promise<AchievementState> {
  try {
    const raw = await getSetting(STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { initialized: !!parsed.initialized, unlocked: parsed.unlocked || {} }
      }
    }
  } catch {
    // повреждённое значение — начинаем с чистого состояния
  }
  return { initialized: false, unlocked: {} }
}

async function saveAchievementState(state: AchievementState): Promise<void> {
  await setSetting(STATE_KEY, JSON.stringify(state))
}

export interface SyncResult {
  unlockedIds: Set<string>
  /** Достижения, открытые именно сейчас (для тоста). Пусто при первой инициализации. */
  newlyUnlocked: AchievementDef[]
}

/**
 * Сверяет текущую статистику с сохранённым состоянием, фиксирует новые разблокировки
 * и возвращает то, что открылось «только что». Первая инициализация сидит baseline
 * без тостов — иначе пользователю прилетел бы спам за всё уже достигнутое.
 */
export async function syncAchievements(stats: AchievementStats): Promise<SyncResult> {
  const state = await loadAchievementState()
  const metIds = evaluateAuto(stats)
  const now = new Date().toISOString()

  const firstRun = !state.initialized
  const newlyUnlocked: AchievementDef[] = []

  for (const id of metIds) {
    if (!state.unlocked[id]) {
      state.unlocked[id] = { at: now }
      if (!firstRun) {
        const def = ACHIEVEMENTS.find((a) => a.id === id)
        if (def) newlyUnlocked.push(def)
      }
    }
  }

  if (firstRun || newlyUnlocked.length > 0) {
    state.initialized = true
    await saveAchievementState(state)
  }

  return { unlockedIds: new Set(Object.keys(state.unlocked)), newlyUnlocked }
}

/** Ручная отметка достижения (для саморазметки эмоций — Фаза 2). */
export async function markManual(id: string): Promise<void> {
  const state = await loadAchievementState()
  if (!state.unlocked[id]) {
    state.unlocked[id] = { at: new Date().toISOString(), manual: true }
    state.initialized = true
    await saveAchievementState(state)
  }
}

/** Загружает сырые данные из БД и считает статистику. */
export async function loadStats(): Promise<AchievementStats> {
  const [entries, sessions, projects, chapters] = await Promise.all([
    getEntries(),
    getSessions(),
    getProjects(),
    getChapters(),
  ])
  return computeStats(entries, sessions, projects, chapters)
}
