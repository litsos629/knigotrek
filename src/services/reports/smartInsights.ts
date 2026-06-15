/**
 * Smart Insights / Coach: data-driven personalized recommendations.
 * Calculates best time, best day, tag correlations, trends, and streak risk.
 */
import { getSessionTags } from '../../config/appConfig'
import i18n from '../../i18n'
import { intlLocale } from '../../i18n/dateLocale'
import { toLocalDateString } from '../../utils/dates'

/** Перевод строки из namespace `reports`. */
const tr = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(key, { ns: 'reports', ...opts }) as string

export interface Insight {
  type: 'productivity' | 'timing' | 'mood' | 'trend' | 'streak' | 'recommendation'
  title: string
  description: string
  icon: string
  priority: number // 1 = highest
}

interface EntryData {
  date: string
  symbols: number
}

interface SessionDataForInsights {
  date: string
  duration: number
  symbols: number
  speed: number
  mood?: string
  tags?: string[]
}

/**
 * Generate personalized insights based on writing data.
 * Returns sorted by priority, top 5 most relevant.
 */
export function generateInsights(
  entries: EntryData[],
  sessions: SessionDataForInsights[]
): Insight[] {
  const insights: Insight[] = []

  if (entries.length === 0 && sessions.length === 0) {
    return [{ type: 'recommendation', title: tr('pdf.insights.emptyTitle'), description: tr('pdf.insights.emptyDesc'), icon: '✨', priority: 1 }]
  }

  // Best time of day
  const bestTime = findBestTimeOfDay(sessions)
  if (bestTime) {
    insights.push({
      type: 'timing',
      title: tr('pdf.insights.bestTimeTitle', { name: bestTime.name }),
      description: tr('pdf.insights.bestTimeDesc', { nameLower: bestTime.name.toLowerCase(), speed: bestTime.avgSpeed.toFixed(1) }),
      icon: '⏰',
      priority: 2
    })
  }

  // Best day of week
  const bestDay = findBestDayOfWeek(entries)
  if (bestDay) {
    insights.push({
      type: 'timing',
      title: tr('pdf.insights.bestDayTitle', { name: bestDay.name }),
      description: tr('pdf.insights.bestDayDesc', { name: bestDay.name, value: Math.round(bestDay.avg).toLocaleString(intlLocale()) }),
      icon: '📅',
      priority: 3
    })
  }

  // Mood → productivity correlation
  const moodInsight = analyzeMoodProductivity(sessions)
  if (moodInsight) {
    insights.push({
      type: 'mood',
      title: tr('pdf.insights.moodBoostTitle', { mood: moodInsight.bestMood, percent: moodInsight.boostPercent }),
      description: moodInsight.description,
      icon: '😊',
      priority: 2
    })
  }

  // Speed trend
  const speedTrend = analyzeSpeedTrend(sessions)
  if (speedTrend) {
    insights.push({
      type: 'trend',
      title: speedTrend.title,
      description: speedTrend.description,
      icon: speedTrend.increasing ? '📈' : '📉',
      priority: speedTrend.increasing ? 4 : 2
    })
  }

  // Streak risk
  const streakRisk = analyzeStreakRisk(entries)
  if (streakRisk) {
    insights.push({
      type: 'streak',
      title: streakRisk.title,
      description: streakRisk.description,
      icon: '🔥',
      priority: 1
    })
  }

  // Consistency analysis
  const consistency = analyzeConsistency(entries)
  if (consistency) {
    insights.push({
      type: 'recommendation',
      title: consistency.title,
      description: consistency.description,
      icon: '📊',
      priority: 3
    })
  }

  // Volume milestone proximity
  const milestone = checkMilestoneProximity(entries)
  if (milestone) {
    insights.push({
      type: 'recommendation',
      title: milestone.title,
      description: milestone.description,
      icon: '🎯',
      priority: 1
    })
  }

  return insights.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

function findBestTimeOfDay(sessions: SessionDataForInsights[]): { name: string; avgSpeed: number } | null {
  if (sessions.length < 3) return null

  const slots: Record<string, { name: string; totalSpeed: number; count: number; hours: number[] }> = {
    morning: { name: tr('pdf.insights.timeOfDay.morning'), totalSpeed: 0, count: 0, hours: [6, 7, 8, 9, 10, 11] },
    afternoon: { name: tr('pdf.insights.timeOfDay.afternoon'), totalSpeed: 0, count: 0, hours: [12, 13, 14, 15, 16, 17] },
    evening: { name: tr('pdf.insights.timeOfDay.evening'), totalSpeed: 0, count: 0, hours: [18, 19, 20, 21, 22, 23] },
    night: { name: tr('pdf.insights.timeOfDay.night'), totalSpeed: 0, count: 0, hours: [0, 1, 2, 3, 4, 5] },
  }

  sessions.forEach(s => {
    const hour = new Date(s.date).getHours()
    const speed = s.duration > 0 ? s.symbols / s.duration : 0
    for (const slot of Object.values(slots)) {
      if (slot.hours.includes(hour)) { slot.totalSpeed += speed; slot.count++; break }
    }
  })

  const ranked = Object.values(slots).filter(s => s.count >= 2).map(s => ({ name: s.name, avgSpeed: s.totalSpeed / s.count })).sort((a, b) => b.avgSpeed - a.avgSpeed)
  return ranked.length > 0 ? ranked[0] : null
}

function findBestDayOfWeek(entries: EntryData[]): { name: string; avg: number } | null {
  if (entries.length < 7) return null
  const refSunday = new Date(2024, 0, 7) // воскресенье
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(refSunday)
    d.setDate(refSunday.getDate() + i)
    const n = d.toLocaleDateString(intlLocale(), { weekday: 'long' })
    return n.charAt(0).toUpperCase() + n.slice(1)
  })
  const dayMap = new Map<number, { total: number; count: number }>()

  entries.forEach(e => {
    const dow = new Date(e.date).getDay()
    const cur = dayMap.get(dow) || { total: 0, count: 0 }
    dayMap.set(dow, { total: cur.total + e.symbols, count: cur.count + 1 })
  })

  let bestDow = -1, bestAvg = 0
  dayMap.forEach((stats, dow) => {
    const avg = stats.total / stats.count
    if (avg > bestAvg) { bestAvg = avg; bestDow = dow }
  })

  return bestDow >= 0 ? { name: days[bestDow], avg: bestAvg } : null
}

function analyzeMoodProductivity(sessions: SessionDataForInsights[]): { bestMood: string; boostPercent: number; description: string } | null {
  const withTags = sessions.filter(s => {
    const tags = getSessionTags(s)
    return tags.length > 0 && s.duration > 0
  })
  if (withTags.length < 5) return null

  const tagMap = new Map<string, { totalSpeed: number; count: number }>()
  withTags.forEach(s => {
    const speed = s.symbols / s.duration
    const tags = getSessionTags(s)
    tags.forEach((tag: string) => {
      const cur = tagMap.get(tag) || { totalSpeed: 0, count: 0 }
      tagMap.set(tag, { totalSpeed: cur.totalSpeed + speed, count: cur.count + 1 })
    })
  })

  const avgAll = withTags.reduce((s, se) => s + se.symbols / se.duration, 0) / withTags.length
  const ranked = Array.from(tagMap.entries())
    .filter(([_, stats]) => stats.count >= 2)
    .map(([tag, stats]) => ({ mood: tag, avgSpeed: stats.totalSpeed / stats.count }))
    .sort((a, b) => b.avgSpeed - a.avgSpeed)

  if (ranked.length === 0 || avgAll === 0) return null

  const best = ranked[0]
  const boostPercent = Math.round(((best.avgSpeed - avgAll) / avgAll) * 100)

  if (boostPercent <= 0) return null

  return {
    bestMood: best.mood,
    boostPercent,
    description: tr('pdf.insights.moodBoostDesc', { mood: best.mood, percent: boostPercent })
  }
}

function analyzeSpeedTrend(sessions: SessionDataForInsights[]): { title: string; description: string; increasing: boolean } | null {
  if (sessions.length < 10) return null

  const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const half = Math.floor(sorted.length / 2)
  const firstHalf = sorted.slice(0, half)
  const secondHalf = sorted.slice(half)

  const avgFirst = firstHalf.reduce((s, se) => s + se.speed, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, se) => s + se.speed, 0) / secondHalf.length

  if (avgFirst === 0) return null
  const change = ((avgSecond - avgFirst) / avgFirst) * 100

  if (Math.abs(change) < 5) return null

  return change > 0
    ? { title: tr('pdf.insights.speedUpTitle'), description: tr('pdf.insights.speedUpDesc', { value: change.toFixed(0) }), increasing: true }
    : { title: tr('pdf.insights.speedDownTitle'), description: tr('pdf.insights.speedDownDesc', { value: Math.abs(change).toFixed(0), time: findBestTimeOfDay(sessions)?.name.toLowerCase() || tr('pdf.insights.comfortableTime') }), increasing: false }
}

function analyzeStreakRisk(entries: EntryData[]): { title: string; description: string } | null {
  if (entries.length < 3) return null

  const sortedDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toLocalDateString(today)

  // Calculate current streak
  let streak = 0
  const checkDate = new Date(today)
  for (let i = 0; i < 365; i++) {
    const dStr = toLocalDateString(checkDate)
    if (sortedDates.includes(dStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1) }
    else break
  }

  if (streak >= 7 && !sortedDates.includes(todayStr)) {
    return {
      title: tr('pdf.insights.streakRiskTitle', { streak }),
      description: tr('pdf.insights.streakRiskDesc', { streak })
    }
  }

  if (streak >= 30) {
    return {
      title: tr('pdf.insights.streakIncredibleTitle', { streak }),
      description: tr('pdf.insights.streakIncredibleDesc', { streak })
    }
  }

  return null
}

function analyzeConsistency(entries: EntryData[]): { title: string; description: string } | null {
  if (entries.length < 14) return null

  const last14 = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).slice(0, 14)
  const activeDays = last14.length
  const ratio = activeDays / 14

  if (ratio >= 0.85) {
    return { title: tr('pdf.insights.consistencyHighTitle'), description: tr('pdf.insights.consistencyHighDesc', { active: activeDays }) }
  } else if (ratio < 0.4) {
    return { title: tr('pdf.insights.consistencyLowTitle'), description: tr('pdf.insights.consistencyLowDesc', { active: activeDays }) }
  }
  return null
}

function checkMilestoneProximity(entries: EntryData[]): { title: string; description: string } | null {
  const total = entries.reduce((s, e) => s + e.symbols, 0)
  const milestones = [10000, 50000, 100000, 250000, 500000, 1000000]

  for (const m of milestones) {
    const remaining = m - total
    if (remaining > 0 && remaining < m * 0.1) {
      return {
        title: tr('pdf.insights.milestoneTitle', { value: (m / 1000).toFixed(0) }),
        description: tr('pdf.insights.milestoneDesc', { remaining: remaining.toLocaleString(intlLocale()), mark: m.toLocaleString(intlLocale()) })
      }
    }
  }
  return null
}
