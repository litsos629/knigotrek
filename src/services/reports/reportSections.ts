/**
 * Shared PDF/image rendering helpers used across all report modules.
 * Extracted from pdfService.ts for modularity.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { getMoodLabel as getMoodLabelFromConfig, getSessionTags, formatTags } from '../../config/appConfig'
import type { ReportTheme } from './reportThemes'
import { intlLocale } from '../../i18n/dateLocale'

/**
 * Секции отчёта с дефолтами «всё включено». UI секций не передаёт —
 * без дефолтов отчёты выходили голым текстом без графиков (находка дизайн-ревизии).
 */
export function resolveSections(sections?: {
  progressChart?: boolean; calendarHeatmap?: boolean; weekdayDynamics?: boolean
  timeDistribution?: boolean; detailedSessions?: boolean; moods?: boolean
  moodCorrelation?: boolean; optimalTime?: boolean; achievements?: boolean
  records?: boolean; periodComparison?: boolean; notes?: boolean
}) {
  return {
    progressChart: true, calendarHeatmap: true, weekdayDynamics: true,
    timeDistribution: true, detailedSessions: true, moods: true,
    moodCorrelation: true, optimalTime: true, achievements: true,
    records: true, periodComparison: true, notes: true,
    ...sections,
  }
}

// Лёгкие хелперы вынесены в reportUtils (без jspdf/шрифтов); реэкспорт сохраняет API
import { tr, escapeHtml, downloadDataUrl, calculateAchievements, calculateCurrentStreak, calculateLongestStreak } from './reportUtils'
export { tr, escapeHtml, downloadDataUrl, calculateAchievements, calculateCurrentStreak, calculateLongestStreak }

// Re-import font setup so any module that uses sections gets fonts registered
import '../pdfFontSetup'
import { toLocalDateString } from '../../utils/dates'

// ========== Constants ==========

export const PAGE_WIDTH = 210 // A4 mm
export const PAGE_HEIGHT = 297
export const MARGIN = 20
export const MARGIN_BOTTOM = 20
export const PAGE_START_Y = 20
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN // 170mm

// ========== Core PDF helpers ==========

/** Check if we need a new page; add one if so. Returns current Y position. */
export function checkAndAddPage(doc: jsPDF, currentY: number, requiredHeight: number = 0): number {
  if (currentY + requiredHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage()
    return PAGE_START_Y
  }
  return currentY
}

/** Add text with Roboto font, auto-wrap, and page break support. Returns new Y. */
export function addText(doc: jsPDF, text: string, x: number, y: number, options?: {
  fontSize?: number
  fontStyle?: 'normal' | 'bold' | 'italic'
  color?: [number, number, number]
  align?: 'left' | 'center' | 'right'
  maxWidth?: number
}): number {
  const fontSize = options?.fontSize || 12
  const fontStyle = options?.fontStyle || 'normal'
  const color = options?.color || [0, 0, 0]
  const align = options?.align || 'left'
  const maxWidth = options?.maxWidth || CONTENT_WIDTH

  doc.setFontSize(fontSize)
  const mappedStyle = fontStyle === 'italic' ? 'normal' : fontStyle
  doc.setFont('Roboto', mappedStyle)
  doc.setTextColor(color[0], color[1], color[2])

  const lines: string[] = doc.splitTextToSize(text, maxWidth)
  const lineHeight = fontSize * 0.4
  let currentY = checkAndAddPage(doc, y, lineHeight)

  for (const line of lines) {
    currentY = checkAndAddPage(doc, currentY, lineHeight)
    doc.text(line, x, currentY, { align })
    currentY += lineHeight
  }

  return currentY + 1
}

// ========== Formatting helpers ==========

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) return tr('pdf.durationHm', { hours, mins })
  return tr('pdf.minutesShort', { value: mins })
}

export function formatSessionDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}.${month}.${year} • ${hours}:${minutes}`
  } catch {
    return dateStr
  }
}

export function formatDateRu(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(intlLocale(), {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(intlLocale(), {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function getMoodLabel(moodId: string): string {
  return getMoodLabelFromConfig(moodId)
}

export function formatNumber(n: number): string {
  return n.toLocaleString(intlLocale())
}

// ========== Themed PDF helpers ==========

/** Add a gradient-simulated header band on current page */
export function addThemedHeader(doc: jsPDF, title: string, subtitle: string, theme: ReportTheme): void {
  const pdf = theme.pdf
  doc.setFillColor(pdf.headerBg[0], pdf.headerBg[1], pdf.headerBg[2])
  doc.rect(0, 0, PAGE_WIDTH, 50, 'F')
  addText(doc, title, PAGE_WIDTH / 2, 25, {
    align: 'center', fontSize: 24, fontStyle: 'bold', color: pdf.headerText
  })
  addText(doc, subtitle, PAGE_WIDTH / 2, 40, {
    align: 'center', fontSize: 14, color: pdf.headerText
  })
}

/** Standard themed footer at bottom of page */
export function addThemedFooter(doc: jsPDF, theme: ReportTheme): void {
  addText(doc, tr('pdf.madeIn'), PAGE_WIDTH / 2, 270, {
    align: 'center', fontSize: 10, color: theme.pdf.textSecondary
  })
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  doc.setTextColor(theme.pdf.textSecondary[0], theme.pdf.textSecondary[1], theme.pdf.textSecondary[2])
  doc.text(`github.com/litsos629/knigotrek \u2022 ${new Date().getFullYear()}`, PAGE_WIDTH / 2, 276, { align: 'center' })
}

/** Add a section divider line */
export function addDivider(doc: jsPDF, y: number, theme: ReportTheme): number {
  doc.setDrawColor(theme.pdf.border[0], theme.pdf.border[1], theme.pdf.border[2])
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  return y + 8
}

/** Themed stat card row in PDF (label: value) */
export function addStatRow(doc: jsPDF, emoji: string, label: string, value: string, x: number, y: number, theme: ReportTheme): number {
  doc.text(emoji, x, y)
  y = addText(doc, `${label}:  ${value}`, x + 10, y, { fontSize: 12, color: theme.pdf.text })
  return y
}

// ========== Visualization sections (extracted from pdfService) ==========

/** Sessions detail table */
export async function addSessionsTable(
  doc: jsPDF,
  sessions: Array<{ date: string; duration: number; symbols: number; speed: number; mood?: string; tags?: string[] }>,
  x: number,
  y: number,
  limit: number = 20,
  theme?: ReportTheme
): Promise<number> {
  if (sessions.length === 0) return y

  const sortedSessions = [...sessions].sort((a, b) => b.symbols - a.symbols).slice(0, limit)
  const tableData = sortedSessions.map((session, index) => {
    const date = new Date(session.date)
    const dateStr = date.toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit' })
    const timeStr = date.toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })
    return [
      (index + 1).toString(),
      `${dateStr} ${timeStr}`,
      tr('pdf.minutesShort', { value: session.duration }),
      session.symbols.toLocaleString(intlLocale()),
      session.speed.toFixed(1),
      formatTags(getSessionTags(session)) || '-'
    ]
  })

  y = addText(doc, tr('pdf.sections.detailedSessions'), x, y, { fontSize: 14, fontStyle: 'bold' })

  const fillColor = theme ? theme.pdf.tableFill : [79, 70, 229] as [number, number, number]
  autoTable(doc, {
    startY: y,
    head: [[tr('pdf.tables.num'), tr('pdf.tables.dateTime'), tr('pdf.tables.duration'), tr('pdf.tables.symbols'), tr('pdf.tables.speed'), tr('pdf.tables.tags')]],
    body: tableData,
    theme: 'striped',
    headStyles: { font: 'Roboto',  fillColor: fillColor as any },
    styles: { font: 'Roboto',  fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 40 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 25 }, 5: { cellWidth: 30 } }
  })

  return ((doc as any).lastAutoTable.finalY || y + 30) + 5
}

/** Weekday dynamics table */
export async function addWeekdayDynamics(
  doc: jsPDF,
  entries: Array<{ date: string; symbols: number }>,
  x: number,
  y: number,
  theme?: ReportTheme
): Promise<number> {
  const weekdayMap = new Map<number, { total: number; count: number }>()
  const refMonday = new Date(2024, 0, 1) // понедельник
  const weekdayNames = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(refMonday)
    d.setDate(refMonday.getDate() + i)
    const name = d.toLocaleDateString(intlLocale(), { weekday: 'long' })
    return name.charAt(0).toUpperCase() + name.slice(1)
  })
  entries.forEach(entry => {
    const date = new Date(entry.date)
    const weekday = date.getDay() === 0 ? 6 : date.getDay() - 1
    const current = weekdayMap.get(weekday) || { total: 0, count: 0 }
    weekdayMap.set(weekday, { total: current.total + entry.symbols, count: current.count + 1 })
  })
  if (weekdayMap.size === 0) return y

  const tableData = weekdayNames.map((name, index) => {
    const stats = weekdayMap.get(index)
    return stats ? [name, Math.round(stats.total / stats.count).toLocaleString(intlLocale()), stats.count.toString()] : [name, '0', '0']
  })

  y = addText(doc, tr('pdf.sections.weekdayDynamics'), x, y, { fontSize: 14, fontStyle: 'bold' })
  const fillColor = theme ? theme.pdf.tableFill : [79, 70, 229] as [number, number, number]
  autoTable(doc, {
    startY: y,
    head: [[tr('pdf.tables.weekday'), tr('pdf.tables.avgSymbols'), tr('pdf.tables.workDaysCol')]],
    body: tableData,
    theme: 'striped',
    headStyles: { font: 'Roboto',  fillColor: fillColor as any },
    styles: { font: 'Roboto',  fontSize: 10, cellPadding: 3 }
  })
  return ((doc as any).lastAutoTable.finalY || y + 30) + 2
}

/** Progress chart rendered via html2canvas */

/** Offscreen-контейнер для рендера html2canvas (размеры в мм; extra — доп. CSS). */
function createOffscreenChartContainer(width: number, height: number, extra = ''): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `position:absolute;left:-9999px;box-sizing:border-box;width:${width}mm;height:${height}mm;background:#ffffff;padding:10px;font-family:system-ui,-apple-system,sans-serif${extra ? ';' + extra : ''}`
  return el
}

export async function addProgressChart(
  doc: jsPDF,
  entries: Array<{ date: string; symbols: number }>,
  targetSymbols: number,
  x: number,
  y: number,
  width: number = 170,
  height: number = 50,
  theme?: ReportTheme
): Promise<number> {
  if (entries.length === 0) return y
  const currentY = checkAndAddPage(doc, y, height + 5)

  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  let cumulative = 0
  const dataPoints = sortedEntries.map(entry => {
    cumulative += entry.symbols
    return { date: entry.date, cumulative, progress: (cumulative / targetSymbols) * 100 }
  })

  const chartContainer = createOffscreenChartContainer(width, height)

  const pxWidth = width * 3.779527559
  const pxHeight = height * 3.779527559
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', `${pxWidth}`)
  svg.setAttribute('height', `${pxHeight}`)
  svg.setAttribute('viewBox', `0 0 ${pxWidth} ${pxHeight}`)

  if (dataPoints.length > 0) {
    const maxProgress = Math.max(...dataPoints.map(d => d.progress), 100)
    const chartWidth = pxWidth - 40
    const chartHeight = pxHeight - 40
    const stepX = dataPoints.length > 1 ? chartWidth / (dataPoints.length - 1) : chartWidth

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    let pathData = ''
    dataPoints.forEach((point, index) => {
      const xPos = 20 + index * stepX
      const yPos = 20 + chartHeight - (point.progress / maxProgress) * chartHeight
      pathData += `${index === 0 ? 'M' : 'L'} ${xPos} ${yPos}`
    })
    path.setAttribute('d', pathData)
    const accentColor = theme ? `rgb(${theme.pdf.accent.join(',')})` : '#4f46e5'
    path.setAttribute('stroke', accentColor)
    path.setAttribute('stroke-width', '2')
    path.setAttribute('fill', 'none')
    svg.appendChild(path)

    if (maxProgress >= 100) {
      const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      const targetY = 20 + chartHeight - (100 / maxProgress) * chartHeight
      targetLine.setAttribute('x1', '20')
      targetLine.setAttribute('y1', `${targetY}`)
      targetLine.setAttribute('x2', `${20 + chartWidth}`)
      targetLine.setAttribute('y2', `${targetY}`)
      targetLine.setAttribute('stroke', '#ef4444')
      targetLine.setAttribute('stroke-width', '1')
      targetLine.setAttribute('stroke-dasharray', '5,5')
      svg.appendChild(targetLine)
    }
  }

  chartContainer.appendChild(svg)
  document.body.appendChild(chartContainer)

  try {
    const canvas = await html2canvas(chartContainer, { width: pxWidth, height: pxHeight, scale: 2, backgroundColor: '#ffffff', logging: false })
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, currentY, width, height)
    document.body.removeChild(chartContainer)
    return currentY + height + 2
  } catch (error) {
    document.body.removeChild(chartContainer)
    throw error
  }
}

/** Calendar heatmap */
export async function addCalendarHeatmap(
  doc: jsPDF,
  entries: Array<{ date: string; symbols: number }>,
  x: number,
  y: number,
  width: number = 170,
  height: number = 60,
  theme?: ReportTheme
): Promise<number> {
  const dateMap = new Map<string, number>()
  entries.forEach(entry => {
    const current = dateMap.get(entry.date) || 0
    dateMap.set(entry.date, current + entry.symbols)
  })
  if (dateMap.size === 0) return y

  const maxSymbols = Math.max(...Array.from(dateMap.values()))

  const daysToShow = 30
  const endDate = new Date()
  endDate.setHours(0, 0, 0, 0)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - daysToShow + 1)

  // Высота — по фактическому числу рядов (заголовок дней недели + недели с офсетом)
  const offsetForRows = (startDate.getDay() + 6) % 7
  const weekRows = Math.ceil((offsetForRows + daysToShow) / 7)
  const PX_PER_MM = 3.779527559
  const realHeight = Math.round((18 + weekRows * 30 + 22) / PX_PER_MM)
  height = realHeight

  const currentY = checkAndAddPage(doc, y, height + 5)

  const calendarContainer = createOffscreenChartContainer(width, height, 'display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:18px repeat(' + weekRows + ',1fr);gap:2px')

  // Заголовок дней недели (Пн..Вс; 2024-01-01 — понедельник)
  for (let d = 0; d < 7; d++) {
    const label = document.createElement('div')
    label.textContent = new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'short' })
    label.style.cssText = 'font-size:11px;color:#9ca3af;text-align:center;align-self:end'
    calendarContainer.appendChild(label)
  }
  // Пустые ячейки до понедельника — сетка выровнена по дням недели
  const mondayOffset = (startDate.getDay() + 6) % 7
  for (let i = 0; i < mondayOffset; i++) {
    calendarContainer.appendChild(document.createElement('div'))
  }

  const accentColor = theme ? theme.pdf.accent : [79, 70, 229]
  for (let i = 0; i < daysToShow; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    const dateStr = toLocalDateString(currentDate)
    const symbols = dateMap.get(dateStr) || 0
    const intensity = maxSymbols > 0 ? symbols / maxSymbols : 0

    const dayCell = document.createElement('div')
    dayCell.style.width = '100%'
    let textColor = '#9ca3af'
    if (intensity > 0.7) {
      dayCell.style.background = `rgb(${accentColor[0] - Math.floor(intensity * 40)},${accentColor[1] - Math.floor(intensity * 40)},${accentColor[2] - Math.floor(intensity * 40)})`
      textColor = '#ffffff'
    } else if (intensity > 0.3) {
      dayCell.style.background = 'rgb(190, 190, 255)'
      textColor = '#374151'
    } else if (intensity > 0) {
      dayCell.style.background = 'rgb(228, 228, 255)'
      textColor = '#4b5563'
    } else {
      dayCell.style.background = '#f3f4f6'
    }
    dayCell.style.border = '1px solid #e5e7eb'
    dayCell.style.borderRadius = '3px'
    // Число дня в ячейке — без него календарь нечитаем
    dayCell.textContent = String(currentDate.getDate())
    dayCell.style.display = 'flex'
    dayCell.style.alignItems = 'center'
    dayCell.style.justifyContent = 'center'
    dayCell.style.fontSize = '12px'
    dayCell.style.color = textColor
    calendarContainer.appendChild(dayCell)
  }

  document.body.appendChild(calendarContainer)
  try {
    const pxWidth = width * 3.779527559
    const pxHeight = height * 3.779527559
    const canvas = await html2canvas(calendarContainer, { width: pxWidth, height: pxHeight, scale: 2, backgroundColor: '#ffffff', logging: false })
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, currentY, width, height)
    document.body.removeChild(calendarContainer)
    return currentY + height + 2
  } catch (error) {
    document.body.removeChild(calendarContainer)
    throw error
  }
}

/** Time distribution bar chart */
export async function addTimeDistribution(
  doc: jsPDF,
  sessions: Array<{ date: string; symbols: number }>,
  x: number,
  y: number,
  width: number = 170,
  height: number = 50,
  theme?: ReportTheme
): Promise<number> {
  if (sessions.length === 0) return y
  const currentY = checkAndAddPage(doc, y, height + 5)

  const hourMap = new Map<number, { total: number; count: number }>()
  sessions.forEach(session => {
    const hour = new Date(session.date).getHours()
    const current = hourMap.get(hour) || { total: 0, count: 0 }
    hourMap.set(hour, { total: current.total + session.symbols, count: current.count + 1 })
  })
  if (hourMap.size === 0) return currentY

  const maxValue = Math.max(...Array.from(hourMap.values()).map(v => v.total / v.count))
  const accentHex = theme ? `rgb(${theme.pdf.accent.join(',')})` : '#4f46e5'

  const chartContainer = createOffscreenChartContainer(width, height)

  const pxWidth = width * 3.779527559
  const pxHeight = height * 3.779527559
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', `${pxWidth}`)
  svg.setAttribute('height', `${pxHeight}`)
  svg.setAttribute('viewBox', `0 0 ${pxWidth} ${pxHeight}`)

  const chartWidth = pxWidth - 40
  const chartHeight = pxHeight - 40
  const barWidth = chartWidth / 24
  const maxBarHeight = chartHeight - 20

  for (let hour = 0; hour < 24; hour++) {
    const stats = hourMap.get(hour)
    const avgValue = stats ? stats.total / stats.count : 0
    const barHeight = maxValue > 0 ? (avgValue / maxValue) * maxBarHeight : 0
    if (barHeight > 0) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', `${20 + hour * barWidth}`)
      rect.setAttribute('y', `${20 + maxBarHeight - barHeight}`)
      rect.setAttribute('width', `${barWidth - 1}`)
      rect.setAttribute('height', `${barHeight}`)
      rect.setAttribute('fill', accentHex)
      rect.setAttribute('opacity', '0.7')
      svg.appendChild(rect)
    }
  }

  // Базовая линия и подписи часов — без оси график не читается
  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  axis.setAttribute('x1', '20')
  axis.setAttribute('y1', `${20 + maxBarHeight}`)
  axis.setAttribute('x2', `${20 + chartWidth}`)
  axis.setAttribute('y2', `${20 + maxBarHeight}`)
  axis.setAttribute('stroke', '#d1d5db')
  axis.setAttribute('stroke-width', '1')
  svg.appendChild(axis)
  for (let hour = 0; hour <= 24; hour += 3) {
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    tick.setAttribute('x', `${20 + Math.min(hour, 23.999) * barWidth}`)
    tick.setAttribute('y', `${20 + maxBarHeight + 16}`)
    tick.setAttribute('font-size', '11')
    tick.setAttribute('fill', '#9ca3af')
    tick.setAttribute('font-family', 'system-ui, sans-serif')
    tick.textContent = `${hour % 24}:00`
    svg.appendChild(tick)
  }

  chartContainer.appendChild(svg)
  document.body.appendChild(chartContainer)

  try {
    const canvas = await html2canvas(chartContainer, { width: pxWidth, height: pxHeight, scale: 2, backgroundColor: '#ffffff', logging: false })
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, currentY, width, height)
    document.body.removeChild(chartContainer)
    return currentY + height + 2
  } catch (error) {
    document.body.removeChild(chartContainer)
    throw error
  }
}

/** Tag/mood analysis visualization */
export async function addMoodsAnalysis(
  doc: jsPDF,
  sessions: Array<{ mood?: string; tags?: string[]; symbols: number }>,
  x: number,
  y: number,
  width: number = 170,
  height: number = 60,
  theme?: ReportTheme
): Promise<number> {
  const currentY = checkAndAddPage(doc, y, height + 5)
  const tagMap = new Map<string, { count: number; totalSymbols: number }>()
  let totalSessions = 0

  sessions.forEach(session => {
    const tags = getSessionTags(session)
    if (tags.length > 0) {
      totalSessions++
      tags.forEach(tag => {
        const current = tagMap.get(tag) || { count: 0, totalSymbols: 0 }
        tagMap.set(tag, { count: current.count + 1, totalSymbols: current.totalSymbols + session.symbols })
      })
    }
  })
  if (tagMap.size === 0) return currentY

  const moodStats = Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      mood: tag, label: tag, count: stats.count,
      percentage: (stats.count / totalSessions) * 100,
      avgSymbols: Math.round(stats.totalSymbols / stats.count)
    }))
    .sort((a, b) => b.count - a.count)

  const accentHex = theme ? `rgb(${theme.pdf.accent.join(',')})` : '#4f46e5'
  const chartContainer = createOffscreenChartContainer(width, height, 'display:flex;flex-direction:column;gap:5px')

  const maxCount = Math.max(...moodStats.map(m => m.count))
  moodStats.forEach(mood => {
    const barContainer = document.createElement('div')
    barContainer.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:10px'
    const label = document.createElement('div')
    label.textContent = mood.label
    label.style.cssText = 'width:80px;flex-shrink:0'
    barContainer.appendChild(label)
    const barWrapper = document.createElement('div')
    barWrapper.style.cssText = 'flex:1;height:20px;background:#f3f4f6;border-radius:4px;position:relative;overflow:hidden'
    const bar = document.createElement('div')
    bar.style.cssText = `width:${(mood.count / maxCount) * 100}%;height:100%;background:${accentHex};border-radius:4px`
    barWrapper.appendChild(bar)
    barContainer.appendChild(barWrapper)
    const count = document.createElement('div')
    count.textContent = `${mood.count} (${mood.percentage.toFixed(0)}%)`
    count.style.cssText = 'width:84px;text-align:right;flex-shrink:0;white-space:nowrap'
    barContainer.appendChild(count)
    chartContainer.appendChild(barContainer)
  })

  document.body.appendChild(chartContainer)
  try {
    const pxWidth = width * 3.779527559
    const pxHeight = height * 3.779527559
    const canvas = await html2canvas(chartContainer, { width: pxWidth, height: pxHeight, scale: 2, backgroundColor: '#ffffff', logging: false })
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, currentY, width, height)
    document.body.removeChild(chartContainer)
    return currentY + height + 2
  } catch (error) {
    document.body.removeChild(chartContainer)
    throw error
  }
}

/** Tag ↔ productivity correlation table */
export async function addMoodProductivityCorrelation(
  doc: jsPDF,
  sessions: Array<{ mood?: string; tags?: string[]; symbols: number; duration: number }>,
  x: number,
  y: number,
  theme?: ReportTheme
): Promise<number> {
  const tagMap = new Map<string, { count: number; totalSymbols: number; totalDuration: number }>()
  sessions.forEach(session => {
    const tags = getSessionTags(session)
    tags.forEach(tag => {
      const current = tagMap.get(tag) || { count: 0, totalSymbols: 0, totalDuration: 0 }
      tagMap.set(tag, {
        count: current.count + 1,
        totalSymbols: current.totalSymbols + session.symbols,
        totalDuration: current.totalDuration + session.duration
      })
    })
  })
  if (tagMap.size === 0) return y

  const correlationData = Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      mood: tag, label: tag, count: stats.count,
      avgSymbols: Math.round(stats.totalSymbols / stats.count),
      avgSpeed: Math.round((stats.totalSymbols / stats.totalDuration) * 100) / 100
    }))
    .sort((a, b) => b.avgSpeed - a.avgSpeed)

  y = addText(doc, tr('pdf.sections.moodCorrelation'), x, y, { fontSize: 14, fontStyle: 'bold' })

  const fillColor = theme ? theme.pdf.tableFill : [79, 70, 229] as [number, number, number]
  autoTable(doc, {
    startY: y,
    head: [[tr('pdf.tables.tag'), tr('pdf.tables.sessionsCol'), tr('pdf.tables.avgSymbols'), tr('pdf.tables.speedPerMin')]],
    body: correlationData.map(m => [m.label, m.count.toString(), m.avgSymbols.toLocaleString(intlLocale()), m.avgSpeed.toFixed(1)]),
    theme: 'striped',
    headStyles: { font: 'Roboto',  fillColor: fillColor as any },
    styles: { font: 'Roboto',  fontSize: 10, cellPadding: 3 }
  })

  const finalY = (doc as any).lastAutoTable.finalY || y + 30
  if (correlationData.length > 0) {
    const best = correlationData[0]
    let ny = finalY + 5
    ny = addText(doc, tr('pdf.moodCorr.best', { tag: best.label }), x, ny, { fontSize: 11 })
    ny = addText(doc, tr('pdf.moodCorr.avgSpeed', { value: best.avgSpeed.toFixed(1) }), x, ny, { fontSize: 10 })
    return ny + 3
  }
  return finalY + 5
}

/** Optimal time analysis */
export async function addOptimalTime(
  doc: jsPDF,
  sessions: Array<{ date: string; symbols: number; duration: number }>,
  x: number,
  y: number,
  theme?: ReportTheme
): Promise<number> {
  if (sessions.length === 0) return y
  const timeSlots = {
    morning: { name: tr('pdf.timeOfDay.morning'), total: 0, count: 0, hours: [6, 7, 8, 9, 10, 11] },
    afternoon: { name: tr('pdf.timeOfDay.afternoon'), total: 0, count: 0, hours: [12, 13, 14, 15, 16, 17] },
    evening: { name: tr('pdf.timeOfDay.evening'), total: 0, count: 0, hours: [18, 19, 20, 21, 22, 23] },
    night: { name: tr('pdf.timeOfDay.night'), total: 0, count: 0, hours: [0, 1, 2, 3, 4, 5] }
  }

  sessions.forEach(session => {
    const hour = new Date(session.date).getHours()
    const speed = session.duration > 0 ? session.symbols / session.duration : 0
    for (const slot of Object.values(timeSlots)) {
      if (slot.hours.includes(hour)) { slot.total += speed; slot.count++; break }
    }
  })

  const timeStats = Object.values(timeSlots)
    .filter(s => s.count > 0)
    .map(s => ({ name: s.name, avgSpeed: s.total / s.count, count: s.count }))
    .sort((a, b) => b.avgSpeed - a.avgSpeed)

  if (timeStats.length === 0) return y

  y = addText(doc, tr('pdf.sections.optimalTime'), x, y, { fontSize: 14, fontStyle: 'bold' })
  const fillColor = theme ? theme.pdf.tableFill : [79, 70, 229] as [number, number, number]
  autoTable(doc, {
    startY: y,
    head: [[tr('pdf.tables.timeOfDayCol'), tr('pdf.tables.sessionsCol'), tr('pdf.tables.avgSpeedPerMin')]],
    body: timeStats.map(s => [s.name, s.count.toString(), s.avgSpeed.toFixed(1)]),
    theme: 'striped',
    headStyles: { font: 'Roboto',  fillColor: fillColor as any },
    styles: { font: 'Roboto',  fontSize: 10, cellPadding: 3 }
  })

  const finalY = (doc as any).lastAutoTable.finalY || y + 30
  if (timeStats.length > 0) {
    let ny = finalY + 5
    ny = addText(doc, tr('pdf.optimalRecommendation', { name: timeStats[0].name }), x, ny, { fontSize: 11 })
    return ny + 3
  }
  return finalY + 5
}

// ========== Achievement & Record helpers ==========

export function calculateRecords(
  entries: Array<{ date: string; symbols: number }>,
  sessions: Array<{ date: string; symbols: number; speed: number }>
) {
  const bestDay = entries.length > 0
    ? entries.reduce((best, e) => e.symbols > best.symbols ? e : best, entries[0])
    : null
  const bestSession = sessions.length > 0
    ? sessions.reduce((best, s) => s.symbols > best.symbols ? s : best, sessions[0])
    : null
  const maxSpeed = sessions.length > 0 ? Math.max(...sessions.map(s => s.speed)) : 0
  const longestStreak = calculateLongestStreak(entries)

  let mostProductiveWeek = 0
  if (entries.length >= 7) {
    const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    for (let i = 0; i <= sorted.length - 7; i++) {
      const weekSymbols = sorted.slice(i, i + 7).reduce((s, e) => s + e.symbols, 0)
      mostProductiveWeek = Math.max(mostProductiveWeek, weekSymbols)
    }
  }

  return { bestDay, bestSession, longestStreak, maxSpeed, mostProductiveWeek }
}

export async function addAchievements(
  doc: jsPDF,
  entries: Array<{ date: string; symbols: number }>,
  x: number,
  y: number,
  theme?: ReportTheme
): Promise<number> {
  if (entries.length === 0) return y
  const totalSymbols = entries.reduce((s, e) => s + e.symbols, 0)
  const streak = calculateCurrentStreak(entries)
  const achievements = calculateAchievements(totalSymbols, entries.length, streak).filter(a => a.unlocked)
  if (achievements.length === 0) return y

  y = addText(doc, tr('pdf.sections.achievements'), x, y, { fontSize: 14, fontStyle: 'bold' })
  const fillColor = theme ? theme.pdf.tableFill : [79, 70, 229] as [number, number, number]
  autoTable(doc, {
    startY: y,
    head: [['', tr('pdf.tables.achievement'), tr('pdf.tables.description')]],
    body: achievements.map(a => [a.emoji, a.title, a.description]),
    theme: 'striped',
    headStyles: { font: 'Roboto',  fillColor: fillColor as any },
    styles: { font: 'Roboto',  fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 50 }, 2: { cellWidth: 100 } }
  })
  return ((doc as any).lastAutoTable.finalY || y + 30) + 5
}

export async function addRecords(
  doc: jsPDF,
  entries: Array<{ date: string; symbols: number }>,
  sessions: Array<{ date: string; symbols: number; speed: number }>,
  x: number,
  y: number,
  theme?: ReportTheme
): Promise<number> {
  if (entries.length === 0 && sessions.length === 0) return y
  const records = calculateRecords(entries, sessions)

  y = addText(doc, tr('pdf.sections.records'), x, y, { fontSize: 14, fontStyle: 'bold' })
  const recordsData: string[][] = []
  if (records.bestDay) {
    recordsData.push(['🏆', tr('pdf.records.bestDay'), tr('pdf.records.symbolsValue', { value: records.bestDay.symbols.toLocaleString(intlLocale()) }), formatDateRu(records.bestDay.date)])
  }
  if (records.bestSession) {
    recordsData.push(['⚡', tr('pdf.records.bestSession'), tr('pdf.records.symbolsValue', { value: records.bestSession.symbols.toLocaleString(intlLocale()) }), formatDateRu(records.bestSession.date)])
  }
  if (records.longestStreak > 0) {
    recordsData.push(['🔥', tr('pdf.records.longestStreak'), tr('pdf.records.daysValue', { count: records.longestStreak }), tr('pdf.records.recordTag')])
  }
  if (records.maxSpeed > 0) {
    recordsData.push(['📈', tr('pdf.records.maxSpeed'), tr('pdf.records.speedValue', { value: records.maxSpeed.toFixed(1) }), tr('pdf.records.recordTag')])
  }
  if (records.mostProductiveWeek > 0) {
    recordsData.push(['📅', tr('pdf.records.bestWeek'), tr('pdf.records.symbolsValue', { value: records.mostProductiveWeek.toLocaleString(intlLocale()) }), tr('pdf.records.forSevenDays')])
  }
  if (recordsData.length === 0) return y

  const fillColor = theme ? theme.pdf.tableFill : [79, 70, 229] as [number, number, number]
  autoTable(doc, {
    startY: y,
    head: [['', tr('pdf.tables.record'), tr('pdf.tables.value'), tr('pdf.tables.details')]],
    body: recordsData,
    theme: 'striped',
    headStyles: { font: 'Roboto',  fillColor: fillColor as any },
    styles: { font: 'Roboto',  fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 70 } }
  })
  return ((doc as any).lastAutoTable.finalY || y + 30) + 5
}

// ========== Period comparison ==========

interface PeriodMetrics {
  totalSymbols: number
  totalSessions: number
  totalDays: number
  averageSpeed: number
  averageDailySymbols: number
  bestDay: number
  longestStreak: number
}

function calcPeriodMetrics(
  entries: Array<{ date: string; symbols: number }>,
  sessions: Array<{ date: string; duration: number; symbols: number; speed: number }>
): PeriodMetrics {
  const totalSymbols = entries.reduce((s, e) => s + e.symbols, 0)
  const totalDuration = sessions.reduce((s, se) => s + se.duration, 0)
  return {
    totalSymbols,
    totalSessions: sessions.length,
    totalDays: entries.length,
    averageSpeed: totalDuration > 0 ? totalSymbols / totalDuration : 0,
    averageDailySymbols: entries.length > 0 ? totalSymbols / entries.length : 0,
    bestDay: entries.length > 0 ? Math.max(...entries.map(e => e.symbols)) : 0,
    longestStreak: calculateLongestStreak(entries),
  }
}

function pctChange(oldV: number, newV: number): number {
  if (oldV === 0) return newV > 0 ? 100 : 0
  return ((newV - oldV) / oldV) * 100
}

function fmtPct(change: number): string {
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
}

export async function addPeriodComparison(
  doc: jsPDF,
  p1Entries: Array<{ date: string; symbols: number }>,
  p1Sessions: Array<{ date: string; duration: number; symbols: number; speed: number }>,
  p2Entries: Array<{ date: string; symbols: number }>,
  p2Sessions: Array<{ date: string; duration: number; symbols: number; speed: number }>,
  p1Label: string,
  p2Label: string,
  x: number,
  y: number,
  theme?: ReportTheme
): Promise<number> {
  const m1 = calcPeriodMetrics(p1Entries, p1Sessions)
  const m2 = calcPeriodMetrics(p2Entries, p2Sessions)

  y = addText(doc, tr('pdf.sections.periodComparison'), x, y, { fontSize: 14, fontStyle: 'bold' })

  const rows = [
    [tr('pdf.comparison.totalSymbols'), formatNumber(m1.totalSymbols), formatNumber(m2.totalSymbols), fmtPct(pctChange(m1.totalSymbols, m2.totalSymbols))],
    [tr('pdf.comparison.sessions'), m1.totalSessions.toString(), m2.totalSessions.toString(), fmtPct(pctChange(m1.totalSessions, m2.totalSessions))],
    [tr('pdf.comparison.workDays'), m1.totalDays.toString(), m2.totalDays.toString(), fmtPct(pctChange(m1.totalDays, m2.totalDays))],
    [tr('pdf.comparison.avgSpeed'), tr('pdf.comparison.speedShort', { value: m1.averageSpeed.toFixed(1) }), tr('pdf.comparison.speedShort', { value: m2.averageSpeed.toFixed(1) }), fmtPct(pctChange(m1.averageSpeed, m2.averageSpeed))],
    [tr('pdf.comparison.bestDay'), formatNumber(m1.bestDay), formatNumber(m2.bestDay), fmtPct(pctChange(m1.bestDay, m2.bestDay))],
  ]

  const fillColor = theme ? theme.pdf.tableFill : [79, 70, 229] as [number, number, number]
  autoTable(doc, {
    startY: y,
    head: [[tr('pdf.tables.metric'), p1Label, p2Label, tr('pdf.tables.change')]],
    body: rows,
    theme: 'striped',
    headStyles: { font: 'Roboto',  fillColor: fillColor as any },
    styles: { font: 'Roboto',  fontSize: 9, cellPadding: 3 }
  })

  const finalY = (doc as any).lastAutoTable.finalY || y + 50
  let ny = finalY + 5

  // Generate comparison insights
  const symChange = pctChange(m1.totalSymbols, m2.totalSymbols)
  if (symChange > 10) {
    ny = addText(doc, tr('pdf.comparison.growth', { value: symChange.toFixed(1) }), x, ny, { fontSize: 10 })
  } else if (symChange < -10) {
    ny = addText(doc, tr('pdf.comparison.decline', { value: Math.abs(symChange).toFixed(1) }), x, ny, { fontSize: 10 })
  }

  return ny + 3
}

// ========== Notes & context ==========

export async function addNotes(
  doc: jsPDF,
  notes: Array<{ id?: string; title: string; content: string; date: string }>,
  periodFrom: string,
  periodTo: string,
  x: number,
  y: number
): Promise<number> {
  const periodNotes = notes.filter(n => {
    const d = n.date.split('T')[0]
    return d >= periodFrom && d <= periodTo
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (periodNotes.length === 0) return y
  y = addText(doc, tr('pdf.sections.notes'), x, y, { fontSize: 14, fontStyle: 'bold' })
  y += 3

  for (const note of periodNotes) {
    y = checkAndAddPage(doc, y, 25)
    y = addText(doc, note.title, x, y, { fontSize: 12, fontStyle: 'bold' })
    y = addText(doc, tr('pdf.notesDate', { date: formatDateRu(note.date) }), x + 5, y, { fontSize: 10 })
    for (const line of note.content.split('\n')) {
      if (line.trim()) y = addText(doc, line.trim(), x + 5, y, { fontSize: 10, maxWidth: 160 })
    }
    y += 3
  }
  return y
}

export async function addProgressToGoal(
  doc: jsPDF,
  currentSymbols: number,
  targetSymbols: number,
  projectTitle: string,
  x: number,
  y: number
): Promise<number> {
  if (targetSymbols === 0) return y
  const progress = Math.min((currentSymbols / targetSymbols) * 100, 100)
  const remaining = Math.max(targetSymbols - currentSymbols, 0)

  y = addText(doc, tr('pdf.goal.title', { project: projectTitle }), x, y, { fontSize: 14, fontStyle: 'bold' })
  y += 3
  y = addText(doc, tr('pdf.goal.current', { current: formatNumber(currentSymbols), target: formatNumber(targetSymbols) }), x, y, { fontSize: 11 })
  y = addText(doc, tr('pdf.goal.done', { value: progress.toFixed(1) }), x, y, { fontSize: 11, fontStyle: 'bold' })
  y = addText(doc, tr('pdf.goal.remaining', { value: formatNumber(remaining) }), x, y, { fontSize: 11 })
  y += 3

  // Simple text-based progress bar (avoiding html2canvas for simplicity here)
  const barWidth = 150
  const filled = (progress / 100) * barWidth
  doc.setFillColor(229, 231, 235)
  doc.rect(x, y, barWidth, 8, 'F')
  doc.setFillColor(79, 70, 229)
  doc.rect(x, y, filled, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(255, 255, 255)
  if (filled > 30) doc.text(`${progress.toFixed(0)}%`, x + filled / 2, y + 6, { align: 'center' })
  y += 12

  return y
}

export async function addProjectContext(
  doc: jsPDF,
  project: { id: string; title: string; genre: string; targetSymbols: number; startDate: string; deadline?: string; description?: string },
  currentSymbols: number,
  totalProjectsCount: number,
  x: number,
  y: number
): Promise<number> {
  y = addText(doc, tr('pdf.sections.projectInfo'), x, y, { fontSize: 14, fontStyle: 'bold' })
  y += 3
  y = addText(doc, tr('pdf.projectInfo.name', { title: project.title }), x, y, { fontSize: 12, fontStyle: 'bold' })

  const { getGenreLabel } = await import('../../config/appConfig')
  y = addText(doc, tr('pdf.projectInfo.genre', { genre: getGenreLabel(project.genre) }), x, y, { fontSize: 11 })

  const progress = project.targetSymbols > 0 ? Math.round((currentSymbols / project.targetSymbols) * 100) : 0
  y = addText(doc, tr('pdf.projectInfo.progress', { current: formatNumber(currentSymbols), target: formatNumber(project.targetSymbols), progress }), x, y, { fontSize: 11 })
  y = addText(doc, tr('pdf.projectInfo.startDate', { date: formatDateRu(project.startDate) }), x, y, { fontSize: 11 })

  if (project.deadline) {
    y = addText(doc, tr('pdf.projectInfo.deadline', { date: formatDateRu(project.deadline) }), x, y, { fontSize: 11 })
  }

  y += 3
  y = addText(doc, tr('pdf.projectInfo.totalProjects', { count: totalProjectsCount }), x, y, { fontSize: 10 })
  return y + 3
}

export async function addGeneralContext(
  doc: jsPDF,
  reportDate: string,
  reportType: string,
  x: number,
  y: number,
  periodFrom?: string,
  periodTo?: string
): Promise<number> {
  y = addText(doc, tr('pdf.sections.reportInfo'), x, y, { fontSize: 14, fontStyle: 'bold' })
  y += 3
  const typeLabel = ['daily', 'weekly', 'monthly', 'project'].includes(reportType)
    ? tr(`pdf.reportTypes.${reportType}`) : reportType
  y = addText(doc, tr('pdf.reportInfo.type', { label: typeLabel }), x, y, { fontSize: 11 })
  if (periodFrom && periodTo) {
    y = addText(doc, tr('pdf.reportInfo.period', { from: formatDateRu(periodFrom), to: formatDateRu(periodTo) }), x, y, { fontSize: 11 })
  }
  y = addText(doc, tr('pdf.reportInfo.created', { date: formatDateRu(reportDate) }), x, y, { fontSize: 11 })
  y = addText(doc, tr('pdf.appLabel'), x, y, { fontSize: 10 })
  return y + 3
}

// ========== Image generation helpers ==========

/** Render an HTML div to a PNG data URL via html2canvas */
export async function renderHtmlToImage(
  container: HTMLDivElement,
  width: number,
  height: number
): Promise<string> {
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, {
      width, height, scale: 1, backgroundColor: null
    })
    const dataUrl = canvas.toDataURL('image/png')
    document.body.removeChild(container)
    return dataUrl
  } catch (error) {
    document.body.removeChild(container)
    throw error
  }
}

/** Create the base container for a social card image */
export function createImageContainer(width: number, height: number, background: string): HTMLDivElement {
  const container = document.createElement('div')
  container.style.cssText = `width:${width}px;height:${height}px;position:absolute;left:-9999px;background:${background};padding:60px;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box`
  return container
}

/** Download a data URL as a file */
// ========== Legacy helpers for backward compat ==========

export function shouldIncludeSection(
  reportType: 'detailed' | 'brief' | 'certificate',
  sectionType: 'basic' | 'detailed' | 'visual' | 'achievement'
): boolean {
  switch (reportType) {
    case 'detailed': return true
    case 'brief': return sectionType === 'basic' || sectionType === 'achievement'
    case 'certificate': return sectionType === 'basic' || sectionType === 'achievement' || sectionType === 'visual'
    default: return true
  }
}

export async function addCertificateHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  style: 'professional' | 'bright' | 'printable'
): Promise<void> {
  const primaryColor = style === 'bright' ? [139, 92, 246] : style === 'printable' ? [0, 0, 0] : [79, 70, 229]
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  if (style === 'bright') {
    doc.rect(0, 0, PAGE_WIDTH, 80, 'F')
    addText(doc, title, PAGE_WIDTH / 2, 35, { align: 'center', fontSize: 32, fontStyle: 'bold', color: [255, 255, 255] })
    addText(doc, subtitle, PAGE_WIDTH / 2, 55, { align: 'center', fontSize: 16, color: [255, 255, 255] })
  } else {
    doc.rect(0, 0, PAGE_WIDTH, 60, 'F')
    addText(doc, title, PAGE_WIDTH / 2, 30, { align: 'center', fontSize: 28, fontStyle: 'bold', color: [255, 255, 255] })
    addText(doc, subtitle, PAGE_WIDTH / 2, 48, { align: 'center', fontSize: 14, color: [255, 255, 255] })
  }
}

export async function addKeyInsights(
  doc: jsPDF,
  entries: Array<{ date: string; symbols: number }>,
  sessions: Array<{ date: string; duration: number; symbols: number; speed: number }>,
  x: number,
  y: number
): Promise<number> {
  if (entries.length === 0 && sessions.length === 0) return y
  const totalSymbols = entries.reduce((s, e) => s + e.symbols, 0)
  const totalDuration = sessions.reduce((s, se) => s + se.duration, 0)
  const avgSpeed = totalDuration > 0 ? totalSymbols / totalDuration : 0
  const avgDaily = entries.length > 0 ? totalSymbols / entries.length : 0

  y = addText(doc, tr('pdf.sections.keyInsights'), x, y, { fontSize: 14, fontStyle: 'bold' })
  const insights: string[] = []
  if (totalSymbols > 0) insights.push(tr('pdf.insightsLines.written', { value: formatNumber(totalSymbols) }))
  if (avgDaily > 0) insights.push(tr('pdf.insightsLines.avgDaily', { value: formatNumber(Math.round(avgDaily)) }))
  if (avgSpeed > 0) insights.push(tr('pdf.insightsLines.avgSpeed', { value: avgSpeed.toFixed(1) }))
  if (entries.length >= 7) insights.push(tr('pdf.insightsLines.activeDays', { count: entries.length }))
  if (entries.length > 0) {
    const best = entries.reduce((b, e) => e.symbols > b.symbols ? e : b, entries[0])
    insights.push(tr('pdf.insightsLines.bestDay', { value: formatNumber(best.symbols) }))
  }
  for (const i of insights) y = addText(doc, `• ${i}`, x, y, { fontSize: 11 })
  return y + 3
}

// ========== Page numbering ==========

/** Add page numbers to all pages of the document (call after all content is added) */
export function addPageNumbers(doc: jsPDF, theme: ReportTheme, startPage: number = 1): void {
  const totalPages = doc.getNumberOfPages()
  for (let i = startPage; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(theme.pdf.textSecondary[0], theme.pdf.textSecondary[1], theme.pdf.textSecondary[2])
    doc.text(`${i} / ${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' })
  }
}

// ========== QR Code for certificates ==========

/** Add QR code linking to github.com/litsos629/knigotrek at the bottom of the page */
export async function addQRCode(doc: jsPDF, y: number, url: string = 'https://github.com/litsos629/knigotrek'): Promise<number> {
  try {
    const QRCode = await import('qrcode')
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 80,
      margin: 1,
      color: { dark: '#4f46e5', light: '#ffffff' }
    })
    const qrSize = 25 // mm
    const qrX = (PAGE_WIDTH - qrSize) / 2
    y = checkAndAddPage(doc, y, qrSize + 10)
    doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize)
    y += qrSize + 3
    y = addText(doc, url, PAGE_WIDTH / 2, y, {
      fontSize: 8, align: 'center', color: [107, 114, 128]
    })
    return y
  } catch {
    return y
  }
}

// ========== Table of contents ==========

export interface TocEntry {
  title: string
  page: number
}

/** Add a table of contents page (call after all content, using collected entries) */
export function addTableOfContents(doc: jsPDF, entries: TocEntry[], theme: ReportTheme): void {
  // Insert TOC as page 2 (after cover/header page)
  const totalPages = doc.getNumberOfPages()
  doc.insertPage(2)

  // Update page numbers in entries (shift by 1 because of inserted page)
  const shiftedEntries = entries.map(e => ({ ...e, page: e.page + 1 }))

  doc.setPage(2)
  let y = PAGE_START_Y + 10
  y = addText(doc, tr('pdf.sections.toc'), PAGE_WIDTH / 2, y, {
    fontSize: 20, fontStyle: 'bold', align: 'center', color: theme.pdf.accent
  })
  y += 5

  for (const entry of shiftedEntries) {
    const label = entry.title
    const pageNum = entry.page.toString()
    // Draw dotted line between title and page number
    addText(doc, label, MARGIN, y, { fontSize: 11, color: theme.pdf.text })
    addText(doc, pageNum, PAGE_WIDTH - MARGIN, y, { fontSize: 11, color: theme.pdf.accent, align: 'right' })
    // Dotted line
    doc.setDrawColor(theme.pdf.border[0], theme.pdf.border[1], theme.pdf.border[2])
    doc.setLineDashPattern([1, 2], 0)
    const textWidth = doc.getTextWidth(label)
    const numWidth = doc.getTextWidth(pageNum)
    doc.line(MARGIN + textWidth + 3, y - 1, PAGE_WIDTH - MARGIN - numWidth - 3, y - 1)
    doc.setLineDashPattern([], 0)
    y += 7
  }

  // Update page numbers to account for inserted TOC page
  addPageNumbers(doc, theme)

  // Restore to last page
  doc.setPage(totalPages + 1)
}
