/**
 * Monthly report: "Monthly deep dive"
 * Weekly breakdown, calendar heatmap, trends, mood analysis, comparison.
 */
import jsPDF from 'jspdf'
import { getTheme } from './reportThemes'
import type { ReportData, NewReportConfig } from './index'
import {
  addText, addThemedHeader, addThemedFooter, addDivider,
  checkAndAddPage, formatNumber, formatDuration, MARGIN, addPageNumbers,
  addProgressChart, addCalendarHeatmap, addWeekdayDynamics,
  addTimeDistribution, addSessionsTable, addMoodsAnalysis,
  addMoodProductivityCorrelation, addOptimalTime,
  addAchievements, addRecords, addPeriodComparison, addNotes,
  tr, resolveSections,
} from './reportSections'
import { intlLocale } from '../../i18n/dateLocale'
import '../pdfFontSetup'
import { toLocalDateString } from '../../utils/dates'

/** Локализованное название месяца с заглавной буквы. */
function monthLabel(month: number, year: number): string {
  const n = new Date(year, month - 1, 1).toLocaleDateString(intlLocale(), { month: 'long' })
  return n.charAt(0).toUpperCase() + n.slice(1)
}

export async function generateMonthlyReport(
  month: number,
  year: number,
  data: ReportData,
  config: NewReportConfig
): Promise<jsPDF> {
  const theme = getTheme(config.theme || 'clean')
  const sections = resolveSections(config.sections)
  const pdf = theme.pdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  addThemedHeader(doc, tr('pdf.titles.monthly'), `${monthLabel(month, year)} ${year}`, theme)

  const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`
  const monthEnd = toLocalDateString(new Date(year, month, 0))

  const monthEntries = data.entries.filter(e => e.date >= monthStart && e.date <= monthEnd)
  const monthSessions = data.sessions.filter(s => {
    const d = s.date.split('T')[0]
    return d >= monthStart && d <= monthEnd
  })

  const totalSymbols = monthEntries.reduce((s, e) => s + e.symbols, 0)
  const totalSessions = monthSessions.length
  const uniqueDays = new Set(monthEntries.map(e => e.date)).size
  const totalDuration = monthSessions.reduce((s, se) => s + se.duration, 0)

  let y = 65

  // Stats
  y = addText(doc, tr('pdf.sections.monthStats'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.text })
  y += 3
  y = addText(doc, tr('pdf.stats.written', { value: formatNumber(totalSymbols) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.workDays', { count: uniqueDays }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.sessions', { count: totalSessions }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.workTime', { value: formatDuration(totalDuration) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  if (uniqueDays > 0) {
    const avgPerDay = Math.round(totalSymbols / uniqueDays)
    y = addText(doc, tr('pdf.stats.avgPerDay', { value: formatNumber(avgPerDay) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  }
  y += 5

  // Best day highlight
  const dayStats = new Map<string, number>()
  monthEntries.forEach(e => dayStats.set(e.date, (dayStats.get(e.date) || 0) + e.symbols))
  let bestDay = '', bestDaySymbols = 0
  dayStats.forEach((sym, date) => { if (sym > bestDaySymbols) { bestDaySymbols = sym; bestDay = date } })

  if (bestDay) {
    y = addDivider(doc, y, theme)
    const bestDayStr = new Date(bestDay).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', weekday: 'long' })
    y = addText(doc, tr('pdf.stats.bestDayInline', { day: bestDayStr, value: formatNumber(bestDaySymbols) }), MARGIN, y, { fontSize: 13, fontStyle: 'bold', color: pdf.accent })
    y += 5
  }

  // Weekly breakdown
  y = checkAndAddPage(doc, y, 30)
  y = addText(doc, tr('pdf.sections.weekBreakdown'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
  const weeks = getWeeklyBreakdown(monthEntries, monthStart, monthEnd)
  for (const week of weeks) {
    y = addText(doc, tr('pdf.stats.weekBreakdownLine', { label: week.label, value: formatNumber(week.symbols), days: week.days }), MARGIN + 5, y, { fontSize: 11, color: pdf.text })
  }
  y += 5

  // Optional sections
  if (sections.progressChart && config.projectId) {
    const project = data.projects.find(p => p.id === config.projectId)
    if (project) {
      y = checkAndAddPage(doc, y, 55)
      y = addText(doc, tr('pdf.sections.progressChart'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
      y = await addProgressChart(doc, monthEntries, project.targetSymbols, MARGIN, y, 170, 40, theme)
    }
  }

  if (sections.calendarHeatmap) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.calendar'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addCalendarHeatmap(doc, monthEntries, MARGIN, y, 170, 50, theme)
  }

  if (sections.weekdayDynamics) {
    y = checkAndAddPage(doc, y, 40)
    y = await addWeekdayDynamics(doc, monthEntries, MARGIN, y, theme)
  }

  if (sections.timeDistribution && monthSessions.length > 0) {
    y = checkAndAddPage(doc, y, 55)
    y = addText(doc, tr('pdf.sections.timeDistribution'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addTimeDistribution(doc, monthSessions, MARGIN, y, 170, 40, theme)
  }

  if (sections.detailedSessions && monthSessions.length > 0) {
    y = checkAndAddPage(doc, y, 60)
    y = await addSessionsTable(doc, monthSessions, MARGIN, y, 15, theme)
  }

  if (sections.moods && monthSessions.length > 0) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.moods'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addMoodsAnalysis(doc, monthSessions, MARGIN, y, 170, 50, theme)
  }

  if (sections.moodCorrelation && monthSessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addMoodProductivityCorrelation(doc, monthSessions, MARGIN, y, theme)
  }

  if (sections.optimalTime && monthSessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addOptimalTime(doc, monthSessions, MARGIN, y, theme)
  }

  if (sections.achievements) {
    y = checkAndAddPage(doc, y, 30)
    y = await addAchievements(doc, monthEntries, MARGIN, y, theme)
  }

  if (sections.records) {
    y = checkAndAddPage(doc, y, 30)
    y = await addRecords(doc, monthEntries, monthSessions, MARGIN, y, theme)
  }

  // Previous month comparison
  if (sections.periodComparison) {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prevStart = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`
    const prevEnd = toLocalDateString(new Date(prevYear, prevMonth, 0))
    const prevEntries = data.entries.filter(e => e.date >= prevStart && e.date <= prevEnd)
    const prevSessions = data.sessions.filter(s => { const d = s.date.split('T')[0]; return d >= prevStart && d <= prevEnd })
    if (prevEntries.length > 0 || prevSessions.length > 0) {
      y = checkAndAddPage(doc, y, 60)
      y = await addPeriodComparison(doc, prevEntries, prevSessions, monthEntries, monthSessions, `${monthLabel(prevMonth, prevYear)} ${prevYear}`, `${monthLabel(month, year)} ${year}`, MARGIN, y, theme)
    }
  }

  if (sections.notes && data.notes && data.notes.length > 0) {
    y = checkAndAddPage(doc, y, 30)
    y = await addNotes(doc, data.notes, monthStart, monthEnd, MARGIN, y)
  }


  addThemedFooter(doc, theme)
  addPageNumbers(doc, theme)
  return doc
}

function getWeeklyBreakdown(entries: Array<{ date: string; symbols: number }>, monthStart: string, monthEnd: string): Array<{ label: string; symbols: number; days: number }> {
  const weeks: Array<{ label: string; symbols: number; days: number }> = []
  const start = new Date(monthStart)
  let weekNum = 1
  let weekStart = new Date(start)

  while (weekStart <= new Date(monthEnd)) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const endStr = weekEnd > new Date(monthEnd) ? monthEnd : toLocalDateString(weekEnd)
    const startStr = toLocalDateString(weekStart)

    const weekEntries = entries.filter(e => e.date >= startStr && e.date <= endStr)
    const symbols = weekEntries.reduce((s, e) => s + e.symbols, 0)
    const days = new Set(weekEntries.map(e => e.date)).size

    weeks.push({ label: tr('pdf.stats.weekNum', { num: weekNum }), symbols, days })
    weekNum++
    weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() + 1)
  }

  return weeks
}
