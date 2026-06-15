/**
 * Лёгкие хелперы отчётов БЕЗ тяжёлых зависимостей (jspdf/html2canvas/шрифты).
 * Компоненты импортируют утилиты отсюда, чтобы статический импорт не тянул
 * в стартовый бандл ~1.5 МБ генераторов PDF (те грузятся динамически).
 */
import i18n from '../../i18n'
import { toLocalDateString } from '../../utils/dates'

/** Перевод строки из namespace `reports`. */
export const tr = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(key, { ns: 'reports', ...opts }) as string

/** Экранирование пользовательских строк перед вставкой в HTML (html2canvas рендерит контейнер в DOM). */
export const escapeHtml = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function calculateAchievements(
  totalSymbols: number,
  entriesCount: number,
  streak: number,
  completedProjects: number = 0
): Array<{ id: string; emoji: string; title: string; description: string; unlocked: boolean }> {
  return [
    { id: 'first', emoji: '✨', title: tr('pdf.achievements.firstTitle'), description: tr('pdf.achievements.firstDesc'), unlocked: entriesCount > 0 },
    { id: '1000', emoji: '🎯', title: tr('pdf.achievements.k1Title'), description: tr('pdf.achievements.k1Desc'), unlocked: totalSymbols >= 1000 },
    { id: '5000', emoji: '🚀', title: tr('pdf.achievements.k5Title'), description: tr('pdf.achievements.k5Desc'), unlocked: totalSymbols >= 5000 },
    { id: '10000', emoji: '⭐', title: tr('pdf.achievements.k10Title'), description: tr('pdf.achievements.k10Desc'), unlocked: totalSymbols >= 10000 },
    { id: '50000', emoji: '💎', title: tr('pdf.achievements.k50Title'), description: tr('pdf.achievements.k50Desc'), unlocked: totalSymbols >= 50000 },
    { id: '100000', emoji: '👑', title: tr('pdf.achievements.k100Title'), description: tr('pdf.achievements.k100Desc'), unlocked: totalSymbols >= 100000 },
    { id: 'first_book', emoji: '🏆', title: tr('pdf.achievements.firstBookTitle'), description: tr('pdf.achievements.firstBookDesc'), unlocked: completedProjects >= 1 },
    { id: 'week', emoji: '🔥', title: tr('pdf.achievements.weekTitle'), description: tr('pdf.achievements.weekDesc'), unlocked: streak >= 7 },
    { id: 'month', emoji: '💪', title: tr('pdf.achievements.monthTitle'), description: tr('pdf.achievements.monthDesc'), unlocked: streak >= 30 },
  ]
}

export function calculateCurrentStreak(entries: Array<{ date: string }>): number {
  if (entries.length === 0) return 0
  const sortedDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  const checkDate = new Date(today)
  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = toLocalDateString(checkDate)
    if (sortedDates.includes(dateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else break
  }
  return streak
}

export function calculateLongestStreak(entries: Array<{ date: string }>): number {
  if (entries.length === 0) return 0
  const sortedDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  let longest = 1, current = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = Math.floor((new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 1) { current++; longest = Math.max(longest, current) }
    else current = 1
  }
  return longest
}
