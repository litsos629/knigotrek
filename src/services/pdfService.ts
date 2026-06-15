/**
 * pdfService.ts — Thin facade that re-exports from the new reports/ modules.
 * Maintains full backward compatibility with all existing imports.
 */
import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { intlLocale } from '../i18n/dateLocale'

// Re-export types that other files import from here
export type { SessionData } from './reports/sessionCard'

export interface ProjectStats {
  totalSymbols: number
  targetSymbols: number
  progress: number
  daysWorked: number
  startDate: string
  deadline?: string
  completedDate?: string
  bestDay?: number
  averageSpeed?: number
  streak?: number
  totalSessions?: number
}

export interface MilestoneData {
  project: {
    id: string
    title: string
    genre: string
    targetSymbols: number
    startDate: string
    deadline?: string
  }
  stats: ProjectStats
}

export interface ReportConfig {
  type: 'detailed' | 'brief' | 'certificate'
  period: {
    from: string
    to: string
  }
  projectId?: string
  include: {
    generalStats: boolean
    progress: boolean
    workingDays: boolean
    averageSpeed: boolean
    progressChart: boolean
    calendarHeatmap: boolean
    weekdayDynamics: boolean
    timeDistribution: boolean
    sessionsCount: boolean
    averageSessionDuration: boolean
    detailedSessions: boolean
    moods: boolean
    achievements: boolean
    records: boolean
    periodComparison: boolean
    frequentMoods: boolean
    moodProductivityCorrelation: boolean
    optimalTime: boolean
    notes: boolean
  }
  style: 'professional' | 'bright' | 'printable'
}

export interface ReportData {
  entries: Array<{
    date: string
    symbols: number
    projectId?: string
  }>
  sessions: Array<{
    date: string
    duration: number
    symbols: number
    speed: number
    mood?: string
    projectId?: string
  }>
  projects: Array<{
    id: string
    title: string
    genre: string
    targetSymbols: number
    startDate: string
    deadline?: string
    description?: string
  }>
  notes?: Array<{
    id?: string
    title: string
    content: string
    date: string
  }>
}

// Import from new modules
import { generateSessionPDF, generateSessionImage, getSessionTextForCopy, type SessionData } from './reports/sessionCard'
import { generateDailyReport as newDailyReport } from './reports/dailyReport'
import { generateWeeklyReport as newWeeklyReport } from './reports/weeklyReport'
import { generateMonthlyReport as newMonthlyReport } from './reports/monthlyReport'
import { generateProjectReport as newProjectReport } from './reports/projectReport'
import {
  addText, formatNumber, tr,
  addProgressChart as newAddProgressChart,
  addCalendarHeatmap as newAddCalendarHeatmap,
  addWeekdayDynamics as newAddWeekdayDynamics,
  addTimeDistribution as newAddTimeDistribution,
  addSessionsTable as newAddSessionsTable,
  addMoodsAnalysis as newAddMoodsAnalysis,
  addMoodProductivityCorrelation as newAddMoodProductivityCorrelation,
  addOptimalTime as newAddOptimalTime,
  addAchievements as newAddAchievements,
  addRecords as newAddRecords,
  addPeriodComparison as newAddPeriodComparison,
  addNotes as newAddNotes,
  addProgressToGoal as newAddProgressToGoal,
  addProjectContext as newAddProjectContext,
  addGeneralContext as newAddGeneralContext,
  addCertificateHeader as newAddCertificateHeader,
  addKeyInsights as newAddKeyInsights,
  MARGIN,
} from './reports/reportSections'
import type { NewReportConfig } from './reports/index'

// Font setup
import './pdfFontSetup'

// ========== Helper to convert legacy config ==========

function legacyToNew(config: ReportConfig): NewReportConfig {
  return {
    type: 'daily',
    theme: 'clean' as const,
    projectId: config.projectId,
    period: config.period,
    sections: {
      progressChart: config.include.progressChart,
      calendarHeatmap: config.include.calendarHeatmap,
      weekdayDynamics: config.include.weekdayDynamics,
      timeDistribution: config.include.timeDistribution,
      detailedSessions: config.include.detailedSessions,
      moods: config.include.moods || config.include.frequentMoods,
      moodCorrelation: config.include.moodProductivityCorrelation,
      optimalTime: config.include.optimalTime,
      achievements: config.include.achievements,
      records: config.include.records,
      periodComparison: config.include.periodComparison,
      notes: config.include.notes,
    }
  }
}

// ========== Session micro-reports (delegated) ==========

export { generateSessionImage as generateSessionMicroImage }
export { getSessionTextForCopy }

export async function generateSessionMicroReport(sessionData: SessionData): Promise<jsPDF> {
  return generateSessionPDF(sessionData, 'clean')
}

// ========== Report generators (delegated to new modules) ==========

export async function generateDailyReport(date: string, data: ReportData, config: ReportConfig): Promise<jsPDF> {
  return newDailyReport(date, data, legacyToNew(config))
}

export async function generateWeeklyReport(dateFrom: string, dateTo: string, data: ReportData, config: ReportConfig): Promise<jsPDF> {
  return newWeeklyReport(dateFrom, dateTo, data, legacyToNew(config))
}

export async function generateMonthlyReport(month: number, year: number, data: ReportData, config: ReportConfig): Promise<jsPDF> {
  return newMonthlyReport(month, year, data, legacyToNew(config))
}

export async function generateProjectReport(projectId: string, data: ReportData, config: ReportConfig): Promise<jsPDF> {
  return newProjectReport(projectId, data, legacyToNew(config))
}

// ========== Milestone & Final reports (kept inline for backward compat) ==========

export async function generateMilestoneReport(milestoneData: MilestoneData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const darkText = [124, 45, 18] as [number, number, number]
  const accentColor = [251, 146, 60] as [number, number, number]

  // Cover page with gradient
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const bgStart = [254, 243, 199] as number[]
  const bgEnd = [254, 215, 170] as number[]
  for (let i = 0; i < pageHeight; i += 2) {
    const ratio = i / pageHeight
    doc.setFillColor(bgStart[0] + (bgEnd[0] - bgStart[0]) * ratio, bgStart[1] + (bgEnd[1] - bgStart[1]) * ratio, bgStart[2] + (bgEnd[2] - bgStart[2]) * ratio)
    doc.rect(0, i, pageWidth, 2, 'F')
  }

  // Achievement number
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2])
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(72)
  const achievementNum = `${milestoneData.stats.progress}%`
  const achW = doc.getTextWidth(achievementNum)
  doc.text(achievementNum, (pageWidth - achW) / 2, pageHeight / 2 - 20)

  doc.setTextColor(darkText[0], darkText[1], darkText[2])
  doc.setFontSize(24)
  const milestoneText = `${tr('pdf.milestone.halfway')}\n«${milestoneData.project.title}»`
  const lines = doc.splitTextToSize(milestoneText, pageWidth - 60)
  let coverY = pageHeight / 2 + 10
  lines.forEach((line: string) => {
    const tw = doc.getTextWidth(line)
    doc.text(line, (pageWidth - tw) / 2, coverY)
    coverY += 12
  })

  doc.addPage()

  // Stats page
  let y = 20
  y = addText(doc, tr('pdf.milestone.statsToday'), MARGIN, y, { fontSize: 20, fontStyle: 'bold', color: darkText })
  y += 3

  const stats = milestoneData.stats
  const startDate = new Date(milestoneData.project.startDate)
  const today = new Date()
  const daysWorked = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  y = addText(doc, tr('pdf.milestone.written', { value: formatNumber(stats.totalSymbols) }), MARGIN, y, { fontSize: 12, color: darkText })
  y = addText(doc, tr('pdf.milestone.target', { value: formatNumber(milestoneData.project.targetSymbols) }), MARGIN, y, { fontSize: 12, color: darkText })
  y = addText(doc, tr('pdf.milestone.progress', { value: stats.progress }), MARGIN, y, { fontSize: 12, color: darkText })
  // Визуальный прогресс-бар — страница была слишком текстовой
  {
    const barW = 160
    const filled = Math.min(stats.progress / 100, 1) * barW
    doc.setFillColor(254, 215, 170)
    doc.roundedRect(MARGIN, y + 2, barW, 9, 2.5, 2.5, 'F')
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
    if (filled > 0) doc.roundedRect(MARGIN, y + 2, filled, 9, 2.5, 2.5, 'F')
    y += 17
  }
  y = addText(doc, tr('pdf.milestone.workPeriod', { count: daysWorked }), MARGIN, y, { fontSize: 12, color: darkText })
  y = addText(doc, tr('pdf.milestone.start', { date: format(startDate, 'dd.MM.yyyy') }), MARGIN, y, { fontSize: 12, color: darkText })
  y = addText(doc, tr('pdf.milestone.today', { date: format(today, 'dd.MM.yyyy') }), MARGIN, y, { fontSize: 12, color: darkText })

  if (stats.streak) {
    y = addText(doc, tr('pdf.milestone.streak', { count: stats.streak }), MARGIN, y, { fontSize: 12, color: darkText })
  }
  if (stats.bestDay) {
    y = addText(doc, tr('pdf.milestone.bestDay', { value: formatNumber(stats.bestDay) }), MARGIN, y, { fontSize: 12, color: darkText })
  }
  if (stats.averageSpeed) {
    y = addText(doc, tr('pdf.milestone.avgPerDay', { value: formatNumber(stats.averageSpeed) }), MARGIN, y, { fontSize: 12, color: darkText })
  }

  y += 10
  addText(doc, tr('pdf.milestone.keepGoing'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: darkText })

  addText(doc, tr('pdf.madeIn'), pageWidth / 2, 270, { align: 'center', fontSize: 10, color: [107, 114, 128] })
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  doc.setTextColor(107, 114, 128)
  doc.text(`github.com/litsos629/knigotrek \u2022 ${new Date().getFullYear()}`, pageWidth / 2, 276, { align: 'center' })

  return doc
}

export async function generateFinalReport(milestoneData: MilestoneData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Dark epic cover
  const bgStart = [17, 24, 39] as number[]
  const bgEnd = [31, 41, 55] as number[]
  for (let i = 0; i < pageHeight; i += 2) {
    const ratio = i / pageHeight
    doc.setFillColor(bgStart[0] + (bgEnd[0] - bgStart[0]) * ratio, bgStart[1] + (bgEnd[1] - bgStart[1]) * ratio, bgStart[2] + (bgEnd[2] - bgStart[2]) * ratio)
    doc.rect(0, i, pageWidth, 2, 'F')
  }

  doc.setTextColor(236, 72, 153)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(48)
  const finalText = tr('pdf.milestone.final')
  doc.text(finalText, (pageWidth - doc.getTextWidth(finalText)) / 2, 60)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  const titleLines = doc.splitTextToSize(milestoneData.project.title, pageWidth - 60)
  let cy = 90
  titleLines.forEach((line: string) => {
    doc.text(line, (pageWidth - doc.getTextWidth(line)) / 2, cy)
    cy += 12
  })

  doc.setFontSize(18)
  cy += 20
  const volText = tr('pdf.milestone.volume', { value: milestoneData.stats.totalSymbols.toLocaleString(intlLocale()) })
  doc.text(volText, (pageWidth - doc.getTextWidth(volText)) / 2, cy)

  doc.addPage()

  // Stats page
  let y = 20
  y = addText(doc, tr('pdf.milestone.finalStats'), MARGIN, y, { fontSize: 20, fontStyle: 'bold', color: [17, 24, 39] })
  y += 3

  const stats = milestoneData.stats
  const startDate = new Date(milestoneData.project.startDate)
  const completedDate = stats.completedDate ? new Date(stats.completedDate) : new Date()

  y = addText(doc, tr('pdf.milestone.written', { value: formatNumber(stats.totalSymbols) }), MARGIN, y, { fontSize: 12 })
  y = addText(doc, tr('pdf.milestone.target', { value: formatNumber(milestoneData.project.targetSymbols) }), MARGIN, y, { fontSize: 12 })
  const achieved = Math.round((stats.totalSymbols / milestoneData.project.targetSymbols) * 100)
  y = addText(doc, tr('pdf.milestone.achieved', { value: achieved }), MARGIN, y, { fontSize: 12 })
  y += 3
  y = addText(doc, tr('pdf.milestone.workPeriod', { count: stats.daysWorked }), MARGIN, y, { fontSize: 12 })
  y = addText(doc, tr('pdf.milestone.start', { date: format(startDate, 'dd.MM.yyyy') }), MARGIN, y, { fontSize: 12 })
  y = addText(doc, tr('pdf.milestone.completed', { date: format(completedDate, 'dd.MM.yyyy') }), MARGIN, y, { fontSize: 12 })

  if (stats.streak) {
    y += 3
    y = addText(doc, tr('pdf.milestone.streakRecord', { count: stats.streak }), MARGIN, y, { fontSize: 11 })
  }
  if (stats.bestDay) {
    y = addText(doc, tr('pdf.milestone.bestDay', { value: formatNumber(stats.bestDay) }), MARGIN, y, { fontSize: 11 })
  }

  y += 10
  y = addText(doc, tr('pdf.milestone.wellDone'), MARGIN, y, { fontSize: 14, fontStyle: 'bold' })
  addText(doc, tr('pdf.milestone.wellDoneDesc', { count: stats.daysWorked }), MARGIN, y, { fontSize: 11, maxWidth: 170 })

  addText(doc, tr('pdf.madeIn'), pageWidth / 2, 270, { align: 'center', fontSize: 10, color: [107, 114, 128] })
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  doc.setTextColor(107, 114, 128)
  doc.text(`github.com/litsos629/knigotrek \u2022 ${new Date().getFullYear()}`, pageWidth / 2, 276, { align: 'center' })

  return doc
}

// ========== Re-export visualization functions for backward compat ==========

export {
  newAddProgressChart as addProgressChart,
  newAddCalendarHeatmap as addCalendarHeatmap,
  newAddWeekdayDynamics as addWeekdayDynamics,
  newAddTimeDistribution as addTimeDistribution,
  newAddSessionsTable as addSessionsTable,
  newAddMoodsAnalysis as addMoodsAnalysis,
  newAddMoodProductivityCorrelation as addMoodProductivityCorrelation,
  newAddOptimalTime as addOptimalTime,
  newAddAchievements as addAchievements,
  newAddRecords as addRecords,
  newAddPeriodComparison as addPeriodComparison,
  newAddNotes as addNotes,
  newAddProgressToGoal as addProgressToGoal,
  newAddProjectContext as addProjectContext,
  newAddGeneralContext as addGeneralContext,
  newAddCertificateHeader as addCertificateHeader,
  newAddKeyInsights as addKeyInsights,
}
