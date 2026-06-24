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
  /** Дней с первой записи (для «ультра» долгого пути). */
  accountAgeDays: number
  /** Суммарно удалённых знаков (режим редактуры) — для «ультра» смелости резать. */
  totalDeleted: number
}

interface EntryLike { date: string; symbols: number; deleted?: number }
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
  now: Date = new Date(),
): AchievementStats {
  const totalSymbols = entries.reduce((s, e) => s + (e.symbols || 0), 0)
  const totalDeleted = entries.reduce((s, e) => s + (e.deleted || 0), 0)

  // Сумма символов по дню (на дату может быть несколько записей — по проекту)
  const byDay = new Map<string, number>()
  for (const e of entries) {
    if (!e.date) continue
    byDay.set(e.date, (byDay.get(e.date) || 0) + (e.symbols || 0))
  }
  const activeDates = [...byDay.entries()].filter(([, v]) => v > 0).map(([d]) => d)
  const maxDaySymbols = byDay.size ? Math.max(0, ...byDay.values()) : 0

  // Возраст «писательского пути» — дни от первой записи до сегодня (1 = первый день).
  let accountAgeDays = 0
  const datedEntries = entries.map((e) => e.date).filter(Boolean)
  if (datedEntries.length) {
    const firstStr = datedEntries.reduce((min, d) => (d < min ? d : min), datedEntries[0])
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const firstMs = parseLocalDate(firstStr).getTime()
    const todayMs = parseLocalDate(todayStr).getTime()
    accountAgeDays = Math.max(0, Math.floor((todayMs - firstMs) / DAY_MS)) + 1
  }

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
    accountAgeDays,
    totalDeleted,
  }
}

/** id авто-достижений, чьи пороги достигнуты при текущей статистике (manual не трогаем). */
export function evaluateAuto(stats: AchievementStats): string[] {
  return ACHIEVEMENTS
    .filter((a) => a.type !== 'manual' && a.metric != null && a.threshold != null)
    .filter((a) => (stats[a.metric as AchievementMetric] ?? 0) >= (a.threshold as number))
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
    // Ручные (эмоциональные) — только по отметке пользователя, метрики нет
    if (a.type === 'manual') {
      const unlocked = unlockedIds.has(a.id)
      return { ...a, unlocked, current: unlocked ? 1 : 0, progress: unlocked ? 1 : 0 }
    }
    const threshold = a.threshold ?? 0
    const current = a.metric ? stats[a.metric as AchievementMetric] ?? 0 : 0
    const unlocked = unlockedIds.has(a.id) || (threshold > 0 && current >= threshold)
    const progress = threshold > 0 ? Math.min(1, current / threshold) : unlocked ? 1 : 0
    return { ...a, unlocked, current, progress }
  })
}

// ---------- Персистентность ----------

const STATE_KEY = 'achievements_state'

/** Область достижений: 'all' — обзор «Все проекты» (пожизненно), либо projectId книги. */
export const ALL_SCOPE = 'all'

interface UnlockedRecord {
  at: string
  manual?: boolean
}

export interface AchievementState {
  initialized: boolean
  unlocked: Record<string, UnlockedRecord>
}

/** Все области в одном settings-ключе (без миграций схемы). */
interface AchievementStore {
  scopes: Record<string, AchievementState>
}

const emptyScope = (): AchievementState => ({ initialized: false, unlocked: {} })

async function loadStore(): Promise<AchievementStore> {
  try {
    const raw = await getSetting(STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        if (parsed.scopes && typeof parsed.scopes === 'object') {
          return { scopes: parsed.scopes as Record<string, AchievementState> }
        }
        // Старый формат (одна глобальная область) → переносим в scope 'all'.
        if (parsed.unlocked || parsed.initialized) {
          return { scopes: { [ALL_SCOPE]: { initialized: !!parsed.initialized, unlocked: parsed.unlocked || {} } } }
        }
      }
    }
  } catch {
    // повреждённое значение — начинаем с чистого состояния
  }
  return { scopes: {} }
}

async function saveStore(store: AchievementStore): Promise<void> {
  await setSetting(STATE_KEY, JSON.stringify(store))
}

/** Состояние одной области (по умолчанию — обзор 'all'). */
export async function loadAchievementState(scope: string = ALL_SCOPE): Promise<AchievementState> {
  const store = await loadStore()
  return store.scopes[scope] ?? emptyScope()
}

export interface SyncResult {
  unlockedIds: Set<string>
  /** Достижения, открытые именно сейчас (для тоста). Пусто при первой инициализации. */
  newlyUnlocked: AchievementDef[]
}

/**
 * Сверяет статистику области с сохранённым состоянием, фиксирует новые разблокировки
 * и возвращает то, что открылось «только что». Первая инициализация области сидит
 * baseline без тостов — иначе прилетел бы спам за всё уже достигнутое (в т.ч. при
 * первом открытии книги с историей).
 */
export async function syncAchievements(stats: AchievementStats, scope: string = ALL_SCOPE): Promise<SyncResult> {
  const store = await loadStore()
  const state = store.scopes[scope] ?? emptyScope()
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
    store.scopes[scope] = state
    await saveStore(store)
  }

  return { unlockedIds: new Set(Object.keys(state.unlocked)), newlyUnlocked }
}

/** Ручная отметка достижения (саморазметка эмоций) в указанной области. */
export async function markManual(id: string, scope: string = ALL_SCOPE): Promise<void> {
  const store = await loadStore()
  const state = store.scopes[scope] ?? emptyScope()
  if (!state.unlocked[id]) {
    state.unlocked[id] = { at: new Date().toISOString(), manual: true }
    state.initialized = true
    store.scopes[scope] = state
    await saveStore(store)
  }
}

/** Снятие ручной отметки (если тапнул не туда). Авто-достижения не трогает. */
export async function unmarkManual(id: string, scope: string = ALL_SCOPE): Promise<void> {
  const store = await loadStore()
  const state = store.scopes[scope]
  if (state && state.unlocked[id]?.manual) {
    delete state.unlocked[id]
    await saveStore(store)
  }
}

/** Объединение ручных отметок по всем книгам — для обзора «Все» (эмоция «была хоть раз»). */
export async function loadManualUnlockedAnyScope(): Promise<Set<string>> {
  const store = await loadStore()
  const ids = new Set<string>()
  for (const state of Object.values(store.scopes)) {
    for (const [id, rec] of Object.entries(state.unlocked)) {
      if (rec.manual) ids.add(id)
    }
  }
  return ids
}

/** Загружает сырые данные из БД и считает статистику. projectId → только эта книга. */
export async function loadStats(projectId?: string): Promise<AchievementStats> {
  const [entries, sessions, projects, chapters] = await Promise.all([
    getEntries(),
    getSessions(),
    getProjects(),
    getChapters(),
  ])
  if (!projectId) {
    return computeStats(entries, sessions, projects, chapters)
  }
  return computeStats(
    entries.filter((e) => e.projectId === projectId),
    sessions.filter((s) => s.projectId === projectId),
    projects.filter((p) => p.id === projectId),
    chapters.filter((c) => c.projectId === projectId),
  )
}
