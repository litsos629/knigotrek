/**
 * Daily report: "What I did today"
 * Sessions list, total symbols, comparison with averages, last 7 days context.
 * Supports PDF (A4), image (1080x1080), and stories (1080x1920) formats.
 */
import jsPDF from 'jspdf'
import type { ThemeId } from './reportThemes'
import { getTheme } from './reportThemes'
import type { ReportData, NewReportConfig } from './index'
import {
  addText, addThemedHeader, addThemedFooter, addPageNumbers, addDivider,
  checkAndAddPage, formatNumber, formatDuration, MARGIN,
  addProgressChart, addCalendarHeatmap, addTimeDistribution,
  addSessionsTable, addMoodsAnalysis, addMoodProductivityCorrelation,
  addOptimalTime, addAchievements, addRecords,
  createImageContainer, renderHtmlToImage,
  calculateCurrentStreak, tr, escapeHtml, resolveSections,
} from './reportSections'
import { intlLocale } from '../../i18n/dateLocale'
import '../pdfFontSetup'
import { toLocalDateString } from '../../utils/dates'

export async function generateDailyReport(
  date: string,
  data: ReportData,
  config: NewReportConfig
): Promise<jsPDF> {
  const theme = getTheme(config.theme || 'clean')
  const sections = resolveSections(config.sections)
  const pdf = theme.pdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Header
  const reportDate = new Date(date)
  const dayName = reportDate.toLocaleDateString(intlLocale(), { weekday: 'long' })
  const dateStr = reportDate.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
  addThemedHeader(doc, tr('pdf.titles.daily'), `${dateStr}, ${dayName}`, theme)

  // Filter data for this day
  const dayEntries = data.entries.filter(e => e.date === date)
  const daySessions = data.sessions.filter(s => s.date.startsWith(date))
  const totalSymbols = dayEntries.reduce((s, e) => s + e.symbols, 0)
  const totalDuration = daySessions.reduce((s, se) => s + se.duration, 0)
  const avgSpeed = totalDuration > 0 ? Math.round((totalSymbols / totalDuration) * 100) / 100 : 0

  let y = 65

  // Day stats
  y = addText(doc, tr('pdf.sections.dayStats'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.text })
  y += 3
  y = addText(doc, tr('pdf.stats.written', { value: formatNumber(totalSymbols) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.sessions', { count: daySessions.length }), MARGIN, y, { fontSize: 12, color: pdf.text })
  y = addText(doc, tr('pdf.stats.workTime', { value: formatDuration(totalDuration) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  if (avgSpeed > 0) {
    y = addText(doc, tr('pdf.stats.avgSpeedPerMin', { value: avgSpeed.toFixed(1) }), MARGIN, y, { fontSize: 12, color: pdf.text })
  }
  y += 5

  // Comparison with weekly average (last 7 days)
  const weekAgo = new Date(date)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = toLocalDateString(weekAgo)
  const weekEntries = data.entries.filter(e => e.date >= weekAgoStr && e.date < date)
  if (weekEntries.length > 0) {
    const weekAvg = Math.round(weekEntries.reduce((s, e) => s + e.symbols, 0) / 7)
    const diff = totalSymbols - weekAvg
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
    y = checkAndAddPage(doc, y, 20)
    y = addDivider(doc, y, theme)
    y = addText(doc, tr('pdf.stats.dayComparison', { arrow, diff: `${diff > 0 ? '+' : ''}${formatNumber(diff)}`, avg: formatNumber(weekAvg) }), MARGIN, y, { fontSize: 11, color: pdf.textSecondary })
    y += 5
  }

  // Project progress if applicable
  if (config.projectId && data.projects.length > 0) {
    const project = data.projects.find(p => p.id === config.projectId)
    if (project) {
      const projEntries = data.entries.filter(e => e.projectId === config.projectId)
      const projTotal = projEntries.reduce((s, e) => s + e.symbols, 0)
      const progress = Math.round((projTotal / project.targetSymbols) * 100)
      y = checkAndAddPage(doc, y, 15)
      y = addText(doc, tr('pdf.stats.projectProgressLine', { title: project.title, progress }), MARGIN, y, { fontSize: 12, fontStyle: 'bold', color: pdf.accent })
      y += 5
    }
  }

  // Optional sections
  if (sections.progressChart && config.projectId) {
    const project = data.projects.find(p => p.id === config.projectId)
    if (project) {
      y = checkAndAddPage(doc, y, 55)
      y = addText(doc, tr('pdf.sections.progressChart'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
      y = await addProgressChart(doc, data.entries.filter(e => e.projectId === config.projectId), project.targetSymbols, MARGIN, y, 170, 40, theme)
    }
  }

  if (sections.calendarHeatmap) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.calendar'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addCalendarHeatmap(doc, data.entries, MARGIN, y, 170, 50, theme)
  }

  if (sections.timeDistribution && daySessions.length > 0) {
    y = checkAndAddPage(doc, y, 55)
    y = addText(doc, tr('pdf.sections.timeDistribution'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addTimeDistribution(doc, daySessions, MARGIN, y, 170, 40, theme)
  }

  if (sections.detailedSessions && daySessions.length > 0) {
    y = checkAndAddPage(doc, y, 60)
    y = await addSessionsTable(doc, daySessions, MARGIN, y, 10, theme)
  }

  if (sections.moods && daySessions.length > 0) {
    y = checkAndAddPage(doc, y, 65)
    y = addText(doc, tr('pdf.sections.moods'), MARGIN, y, { fontSize: 14, fontStyle: 'bold', color: pdf.text })
    y = await addMoodsAnalysis(doc, daySessions, MARGIN, y, 170, 50, theme)
  }

  if (sections.moodCorrelation && daySessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addMoodProductivityCorrelation(doc, daySessions, MARGIN, y, theme)
  }

  if (sections.optimalTime && daySessions.length > 0) {
    y = checkAndAddPage(doc, y, 40)
    y = await addOptimalTime(doc, daySessions, MARGIN, y, theme)
  }

  if (sections.achievements && dayEntries.length > 0) {
    y = checkAndAddPage(doc, y, 30)
    y = await addAchievements(doc, dayEntries, MARGIN, y, theme)
  }

  if (sections.records && (dayEntries.length > 0 || daySessions.length > 0)) {
    y = checkAndAddPage(doc, y, 30)
    await addRecords(doc, dayEntries, daySessions, MARGIN, y, theme)
  }

  addThemedFooter(doc, theme)
  addPageNumbers(doc, theme)
  return doc
}

// ========== Daily image helpers ==========

interface DailyImageData {
  date: string
  totalSymbols: number
  sessionsCount: number
  totalDuration: number
  avgSpeed: number
  streak?: number
  projectTitle?: string
  projectProgress?: number
}

function prepareDailyData(date: string, data: ReportData, projectId?: string): DailyImageData {
  const dayEntries = data.entries.filter(e => e.date === date)
  const daySessions = data.sessions.filter(s => s.date.startsWith(date))
  const totalSymbols = dayEntries.reduce((s, e) => s + e.symbols, 0)
  const totalDuration = daySessions.reduce((s, se) => s + se.duration, 0)
  const avgSpeed = totalDuration > 0 ? Math.round((totalSymbols / totalDuration) * 10) / 10 : 0
  const streak = calculateCurrentStreak(data.entries)

  let projectTitle: string | undefined
  let projectProgress: number | undefined
  if (projectId) {
    const project = data.projects.find(p => p.id === projectId)
    if (project) {
      projectTitle = project.title
      const projTotal = data.entries.filter(e => e.projectId === projectId).reduce((s, e) => s + e.symbols, 0)
      projectProgress = Math.round((projTotal / project.targetSymbols) * 100)
    }
  }

  return { date, totalSymbols, sessionsCount: daySessions.length, totalDuration, avgSpeed, streak, projectTitle, projectProgress }
}

function buildDailyCardHtml(d: DailyImageData, theme: ReturnType<typeof getTheme>, isStories: boolean): string {
  const img = theme.image
  const dateStr = new Date(d.date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
  const dayName = new Date(d.date).toLocaleDateString(intlLocale(), { weekday: 'long' })

  const cardBg = img.cardBg
  const cardBorder = img.cardBorder
  const secondaryColor = img.textSecondary
  const statColor = img.statValueColor
  const footerColor = img.footerColor
  const textColor = img.text

  const statCardStyle = `background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;padding:${isStories ? '24px 20px' : '20px 24px'};text-align:center;flex:1`
  const statValueStyle = `font-size:${isStories ? '48px' : '56px'};font-weight:bold;color:${statColor};line-height:1.1`
  const statLabelStyle = `font-size:${isStories ? '16px' : '18px'};color:${secondaryColor};margin-top:4px`

  const hShort = tr('pdf.dailyImage.hoursShort')
  const mShort = tr('pdf.dailyImage.minShort')
  const durationStr = d.totalDuration >= 60
    ? `${Math.floor(d.totalDuration / 60)}${hShort} ${d.totalDuration % 60 > 0 ? (d.totalDuration % 60) + mShort : ''}`
    : `${d.totalDuration}`

  const statsGrid = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:${isStories ? '16px' : '20px'};width:100%">
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${formatNumber(d.totalSymbols)}</div>
        <div style="${statLabelStyle}">${tr('pdf.dailyImage.symbols')}</div>
      </div>
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${d.sessionsCount}</div>
        <div style="${statLabelStyle}">${tr('pdf.dailyImage.sessions')}</div>
      </div>
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${durationStr}</div>
        <div style="${statLabelStyle}">${tr('pdf.dailyImage.time')}</div>
      </div>
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${d.avgSpeed > 0 ? d.avgSpeed.toFixed(1) : '—'}</div>
        <div style="${statLabelStyle}">${tr('pdf.dailyImage.charsPerMin')}</div>
      </div>
    </div>
  `

  const extras: string[] = []
  if (d.streak && d.streak > 1) {
    extras.push(`<div style="font-size:${isStories ? '28px' : '32px'};color:${textColor}">${tr('pdf.dailyImage.streakDays', { count: d.streak })}</div>`)
  }
  if (d.projectTitle && d.projectProgress !== undefined) {
    extras.push(`<div style="font-size:${isStories ? '24px' : '28px'};color:${secondaryColor}">${tr('pdf.dailyImage.project', { title: escapeHtml(d.projectTitle), progress: d.projectProgress })}</div>`)
  }

  return `
    <div style="text-align:center;color:${textColor}">
      <div style="font-size:${isStories ? '36px' : '48px'};font-weight:bold;letter-spacing:2px;margin-bottom:8px">${tr('pdf.dailyImage.title')}</div>
      <div style="font-size:${isStories ? '22px' : '26px'};color:${secondaryColor}">${dateStr}, ${dayName}</div>
    </div>

    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:${isStories ? '24px' : '32px'};width:100%">
      ${statsGrid}
      ${extras.length > 0 ? `<div style="display:flex;flex-direction:column;gap:8px;align-items:center;margin-top:8px">${extras.join('')}</div>` : ''}
    </div>

    <div style="text-align:center;color:${footerColor}">
      <div style="width:60%;margin:0 auto;border-top:1px solid ${cardBorder};padding-top:16px"></div>
      <div style="font-size:${isStories ? '20px' : '22px'}">${tr('pdf.brand')}</div>
    </div>
  `
}

/** Generate daily summary image (1080x1080 square format) */
export async function generateDailyImage(
  date: string,
  data: ReportData,
  themeId: ThemeId = 'clean',
  projectId?: string
): Promise<string> {
  const theme = getTheme(themeId)
  const d = prepareDailyData(date, data, projectId)
  const container = createImageContainer(1080, 1080, theme.image.gradient)
  container.style.color = theme.image.text
  container.innerHTML = buildDailyCardHtml(d, theme, false)
  return renderHtmlToImage(container, 1080, 1080)
}

/** Generate daily summary image (1080x1920 stories format) */
export async function generateDailyStoryImage(
  date: string,
  data: ReportData,
  themeId: ThemeId = 'clean',
  projectId?: string
): Promise<string> {
  const theme = getTheme(themeId)
  const d = prepareDailyData(date, data, projectId)
  const container = createImageContainer(1080, 1920, theme.image.gradient)
  container.style.color = theme.image.text
  container.style.padding = '80px 60px'
  container.innerHTML = buildDailyCardHtml(d, theme, true)
  return renderHtmlToImage(container, 1080, 1920)
}
