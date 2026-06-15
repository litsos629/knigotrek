/**
 * Project report: "Full project story"
 * Project info, progress bar, timeline, records, session analytics, forecast.
 */
import jsPDF from 'jspdf'
import { getTheme } from './reportThemes'
import type { ReportData, NewReportConfig } from './index'
import {
  addText, addThemedHeader, addThemedFooter, addPageNumbers, addDivider,
  checkAndAddPage, formatNumber, formatDuration, formatDateRu,
  MARGIN,
  addProgressChart, addCalendarHeatmap, addWeekdayDynamics,
  addTimeDistribution, addSessionsTable, addMoodsAnalysis,
  addMoodProductivityCorrelation, addOptimalTime,
  addAchievements, addRecords,
  addNotes, tr, resolveSections,
} from './reportSections'
import { getGenreLabel } from '../../config/appConfig'
import '../pdfFontSetup'
import { todayLocal } from '../../utils/dates'

export async function generateProjectReport(
  projectId: string,
  data: ReportData,
  config: NewReportConfig
): Promise<jsPDF> {
  const project = data.projects.find(p => p.id === projectId)
  if (!project) throw new Error('Project not found')

  const theme = getTheme(config.theme || 'clean')
  const sections = resolveSections(config.sections)
  const pdf = theme.pdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  addThemedHeader(doc, tr('pdf.titles.project'), `«${project.title}»`, theme)

  const filteredEntries = data.entries.filter(e => e.projectId === projectId)
  const filteredSessions = data.sessions.filter(s => s.projectId === projectId)
  const totalSymbols = filteredEntries.reduce((s, e) => s + e.symbols, 0)
  const progress = Math.round((totalSymbols / project.targetSymbols) * 100)
  const daysWorked = new Set(filteredEntries.map(e => e.date)).size
  const totalDuration = filteredSessions.reduce((s, se) => s + se.duration, 0)

  let y = 65

  // Project info
  y = addText(doc, tr('pdf.sections.projectInfo'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.text })
  y += 3
  y = addText(doc, tr('pdf.projectReport.genre', { genre: getGenreLabel(project.genre) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.projectReport.startDate', { date: formatDateRu(project.startDate) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  if (project.deadline) {
    y = addText(doc, tr('pdf.projectReport.deadline', { date: formatDateRu(project.deadline) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  }
  y += 5

  // Progress visualization
  y = addText(doc, tr('pdf.sections.progress'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.text })
  y += 3
  y = addText(doc, tr('pdf.projectReport.writtenOfTarget', { value: formatNumber(totalSymbols), target: formatNumber(project.targetSymbols), progress }), MARGIN, y, { fontSize: 12, color: pdf.text })
  // Progress bar
  const barW = 150
  const filled = Math.min((totalSymbols / project.targetSymbols), 1) * barW
  doc.setFillColor(pdf.border[0], pdf.border[1], pdf.border[2])
  doc.roundedRect(MARGIN, y + 2, barW, 8, 2, 2, 'F')
  doc.setFillColor(pdf.accent[0], pdf.accent[1], pdf.accent[2])
  if (filled > 0) doc.roundedRect(MARGIN, y + 2, filled, 8, 2, 2, 'F')
  y += 15

  // Session analytics
  y = addText(doc, tr('pdf.sections.analytics'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.text })
  y += 3
  y = addText(doc, tr('pdf.projectReport.workDays', { count: daysWorked }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.projectReport.sessions', { count: filteredSessions.length }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.projectReport.workTime', { value: formatDuration(totalDuration) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  if (daysWorked > 0) {
    y = addText(doc, tr('pdf.projectReport.avgPerDay', { value: formatNumber(Math.round(totalSymbols / daysWorked)) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  }
  y += 5

  // Forecast
  if (daysWorked > 0 && totalSymbols < project.targetSymbols) {
    const avgPerDay = totalSymbols / daysWorked
    const remaining = project.targetSymbols - totalSymbols
    const daysNeeded = Math.ceil(remaining / avgPerDay)
    y = addDivider(doc, y, theme)
    y = addText(doc, tr('pdf.projectReport.forecast', { days: daysNeeded }), MARGIN, y, { fontSize: 12, fontStyle: 'bold', color: pdf.accent })
    if (project.deadline) {
      const deadlineDate = new Date(project.deadline)
      const today = new Date()
      const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysNeeded <= daysLeft) {
        y = addText(doc, tr('pdf.projectReport.deadlineOk', { days: daysLeft }), MARGIN, y, { fontSize: 11, color: pdf.text })
      } else {
        y = addText(doc, tr('pdf.projectReport.deadlineWarn', { left: daysLeft, needed: daysNeeded }), MARGIN, y, { fontSize: 11, color: [220, 38, 38] })
      }
    }
    y += 5
  }

  // Optional sections
  if (sections.progressChart) {
    y = checkAndAddPage(doc, y, 55)
    y = addText(doc, tr('pdf.sections.progressChart'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addProgressChart(doc, filteredEntries, project.targetSymbols, MARGIN, y, 170, 40, theme)
  }

  if (sections.calendarHeatmap) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.calendar'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addCalendarHeatmap(doc, filteredEntries, MARGIN, y, 170, 50, theme)
  }

  if (sections.weekdayDynamics) {
    y = checkAndAddPage(doc, y, 40)
    y = await addWeekdayDynamics(doc, filteredEntries, MARGIN, y, theme)
  }

  if (sections.timeDistribution && filteredSessions.length > 0) {
    y = checkAndAddPage(doc, y, 55)
    y = addText(doc, tr('pdf.sections.timeDistribution'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addTimeDistribution(doc, filteredSessions, MARGIN, y, 170, 40, theme)
  }

  if (sections.detailedSessions && filteredSessions.length > 0) {
    y = checkAndAddPage(doc, y, 60)
    y = await addSessionsTable(doc, filteredSessions, MARGIN, y, 20, theme)
  }

  if (sections.moods && filteredSessions.length > 0) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.moods'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addMoodsAnalysis(doc, filteredSessions, MARGIN, y, 170, 50, theme)
  }

  if (sections.moodCorrelation && filteredSessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addMoodProductivityCorrelation(doc, filteredSessions, MARGIN, y, theme)
  }

  if (sections.optimalTime && filteredSessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addOptimalTime(doc, filteredSessions, MARGIN, y, theme)
  }

  if (sections.achievements) {
    y = checkAndAddPage(doc, y, 30)
    y = await addAchievements(doc, filteredEntries, MARGIN, y, theme)
  }

  if (sections.records) {
    y = checkAndAddPage(doc, y, 30)
    y = await addRecords(doc, filteredEntries, filteredSessions, MARGIN, y, theme)
  }

  if (sections.notes && data.notes && data.notes.length > 0) {
    y = checkAndAddPage(doc, y, 30)
    const periodFrom = config.period?.from || project.startDate
    const periodTo = config.period?.to || todayLocal()
    y = await addNotes(doc, data.notes, periodFrom, periodTo, MARGIN, y)
  }

  addThemedFooter(doc, theme)
  addPageNumbers(doc, theme)
  return doc
}
