/**
 * Weekly report: "My week in writing"
 * Daily breakdown, best day, mood distribution, comparison with previous week.
 */
import jsPDF from 'jspdf'
import { getTheme } from './reportThemes'
import type { ReportData, NewReportConfig } from './index'
import {
  addText, addThemedHeader, addThemedFooter, addDivider,
  checkAndAddPage, formatNumber, formatDuration, formatDateShort,
  MARGIN, addPageNumbers,
  addProgressChart, addCalendarHeatmap, addWeekdayDynamics,
  addTimeDistribution, addSessionsTable, addMoodsAnalysis,
  addMoodProductivityCorrelation, addOptimalTime,
  addAchievements, addRecords, addPeriodComparison, addNotes,
  tr, resolveSections,
} from './reportSections'
import { intlLocale } from '../../i18n/dateLocale'
import '../pdfFontSetup'
import { toLocalDateString } from '../../utils/dates'

export async function generateWeeklyReport(
  dateFrom: string,
  dateTo: string,
  data: ReportData,
  config: NewReportConfig
): Promise<jsPDF> {
  const theme = getTheme(config.theme || 'clean')
  const sections = resolveSections(config.sections)
  const pdf = theme.pdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const fromStr = formatDateShort(dateFrom)
  const toStr = formatDateShort(dateTo)
  addThemedHeader(doc, tr('pdf.titles.weekly'), `${fromStr} - ${toStr}`, theme)

  // Filter data
  const periodEntries = data.entries.filter(e => e.date >= dateFrom && e.date <= dateTo)
  const periodSessions = data.sessions.filter(s => {
    const d = s.date.split('T')[0]
    return d >= dateFrom && d <= dateTo
  })

  const totalSymbols = periodEntries.reduce((s, e) => s + e.symbols, 0)
  const totalSessions = periodSessions.length
  const totalDuration = periodSessions.reduce((s, se) => s + se.duration, 0)
  const avgSpeed = totalDuration > 0 ? Math.round((totalSymbols / totalDuration) * 100) / 100 : 0
  const uniqueDays = new Set(periodEntries.map(e => e.date)).size

  let y = 65

  // Overall stats
  y = addText(doc, tr('pdf.sections.weekStats'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.text })
  y = addText(doc, tr('pdf.stats.written', { value: formatNumber(totalSymbols) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.sessions', { count: totalSessions }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.workDaysOf7', { count: uniqueDays }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.workTime', { value: formatDuration(totalDuration) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  if (avgSpeed > 0) {
    y = addText(doc, tr('pdf.stats.avgSpeedPerMin', { value: avgSpeed.toFixed(1) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  }
  y += 5

  // Best day highlight
  const dayStats = new Map<string, number>()
  periodEntries.forEach(e => dayStats.set(e.date, (dayStats.get(e.date) || 0) + e.symbols))
  let bestDay = '', bestDaySymbols = 0
  dayStats.forEach((sym, date) => { if (sym > bestDaySymbols) { bestDaySymbols = sym; bestDay = date } })

  if (bestDay) {
    y = checkAndAddPage(doc, y, 20)
    y = addDivider(doc, y, theme)
    const bestDayStr = new Date(bestDay).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', weekday: 'long' })
    y = addText(doc, tr('pdf.stats.bestDay', { value: bestDayStr }), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.accent })
    y = addText(doc, tr('pdf.stats.symbolsValue', { value: formatNumber(bestDaySymbols) }), MARGIN, y, { fontSize: 12, color: pdf.text })
    y += 5
  }

  // Optional sections
  if (sections.progressChart && config.projectId) {
    const project = data.projects.find(p => p.id === config.projectId)
    if (project) {
      y = checkAndAddPage(doc, y, 55)
      y = addText(doc, tr('pdf.sections.progressChart'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
      y = await addProgressChart(doc, periodEntries, project.targetSymbols, MARGIN, y, 170, 40, theme)
    }
  }

  if (sections.calendarHeatmap) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.calendar'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addCalendarHeatmap(doc, periodEntries, MARGIN, y, 170, 50, theme)
  }

  if (sections.weekdayDynamics) {
    y = checkAndAddPage(doc, y, 40)
    y = await addWeekdayDynamics(doc, periodEntries, MARGIN, y, theme)
  }

  if (sections.timeDistribution) {
    y = checkAndAddPage(doc, y, 55)
    y = addText(doc, tr('pdf.sections.timeDistribution'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addTimeDistribution(doc, periodSessions, MARGIN, y, 170, 40, theme)
  }

  if (sections.detailedSessions && periodSessions.length > 0) {
    y = checkAndAddPage(doc, y, 60)
    y = await addSessionsTable(doc, periodSessions, MARGIN, y, 10, theme)
  }

  if (sections.moods && periodSessions.length > 0) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.moods'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addMoodsAnalysis(doc, periodSessions, MARGIN, y, 170, 50, theme)
  }

  if (sections.moodCorrelation && periodSessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addMoodProductivityCorrelation(doc, periodSessions, MARGIN, y, theme)
  }

  if (sections.optimalTime && periodSessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addOptimalTime(doc, periodSessions, MARGIN, y, theme)
  }

  if (sections.achievements) {
    y = checkAndAddPage(doc, y, 30)
    y = await addAchievements(doc, periodEntries, MARGIN, y, theme)
  }

  if (sections.records) {
    y = checkAndAddPage(doc, y, 30)
    y = await addRecords(doc, periodEntries, periodSessions, MARGIN, y, theme)
  }

  // Previous week comparison
  if (sections.periodComparison) {
    const prevFrom = new Date(dateFrom)
    prevFrom.setDate(prevFrom.getDate() - 7)
    const prevTo = new Date(dateTo)
    prevTo.setDate(prevTo.getDate() - 7)
    const pfStr = toLocalDateString(prevFrom)
    const ptStr = toLocalDateString(prevTo)
    const prevEntries = data.entries.filter(e => e.date >= pfStr && e.date <= ptStr)
    const prevSessions = data.sessions.filter(s => { const d = s.date.split('T')[0]; return d >= pfStr && d <= ptStr })
    if (prevEntries.length > 0 || prevSessions.length > 0) {
      y = checkAndAddPage(doc, y, 60)
      y = await addPeriodComparison(doc, prevEntries, prevSessions, periodEntries, periodSessions, formatDateShort(pfStr) + ' - ' + formatDateShort(ptStr), `${fromStr} - ${toStr}`, MARGIN, y, theme)
    }
  }

  if (sections.notes && data.notes && data.notes.length > 0) {
    y = checkAndAddPage(doc, y, 30)
    y = await addNotes(doc, data.notes, dateFrom, dateTo, MARGIN, y)
  }

  addThemedFooter(doc, theme)
  addPageNumbers(doc, theme)
  return doc
}
