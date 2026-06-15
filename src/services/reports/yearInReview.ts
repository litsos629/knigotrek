/**
 * Year in Review (Spotify Wrapped style): multi-slide annual summary.
 * Generates as multi-page PDF or series of 1080x1080 images.
 */
import jsPDF from 'jspdf'
import type { ThemeId } from './reportThemes'
import { getTheme } from './reportThemes'
import {
  addText, formatNumber, formatDateRu,
  PAGE_WIDTH, PAGE_HEIGHT, MARGIN, tr, escapeHtml,
  createImageContainer, renderHtmlToImage,
} from './reportSections'
import { intlLocale } from '../../i18n/dateLocale'
import '../pdfFontSetup'

export interface YearInReviewData {
  year: number
  totalSymbols: number
  totalSessions: number
  totalDuration: number // minutes
  activeDays: number
  longestStreak: number
  bestDay: { date: string; symbols: number } | null
  favoriteTimeSlot: string
  topMood: { mood: string; percentage: number } | null
  projects: Array<{ title: string; symbols: number; completed: boolean }>
  monthlySymbols: number[] // 12 values, one per month
}

// Motivational comparisons
function getSymbolsComparison(symbols: number): string {
  if (symbols >= 400000) return tr('pdf.year.vol2Novels')
  if (symbols >= 200000) return tr('pdf.year.vol1Novel')
  if (symbols >= 100000) return tr('pdf.year.volNovella')
  if (symbols >= 50000) return tr('pdf.year.volSmallBook')
  if (symbols >= 20000) return tr('pdf.year.volBigStory')
  return tr('pdf.year.volStart')
}

// ========== Image slides (1080x1080 each) ==========

function slideBase(gradient: string, textColor: string): HTMLDivElement {
  const c = createImageContainer(1080, 1080, gradient)
  c.style.color = textColor
  c.style.padding = '80px'
  c.style.alignItems = 'center'
  c.style.textAlign = 'center'
  return c
}

async function renderSlide(html: string, themeId: ThemeId): Promise<string> {
  const theme = getTheme(themeId)
  const c = slideBase(theme.image.gradient, theme.image.text)
  c.innerHTML = html + `<div style="font-size:20px;color:${theme.image.footerColor}">${tr('pdf.year.brandYear', { year: new Date().getFullYear() })}</div>`
  return renderHtmlToImage(c, 1080, 1080)
}

export async function generateYearInReviewSlides(
  data: YearInReviewData,
  themeId: ThemeId = 'clean'
): Promise<string[]> {
  const theme = getTheme(themeId)
  const img = theme.image
  const slides: string[] = []

  // Slide 1: Cover
  slides.push(await renderSlide(`
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px">
      <div style="font-size:96px">📚</div>
      <div style="font-size:52px;font-weight:bold">${tr('pdf.year.image.coverLine1', { year: data.year })}</div>
      <div style="font-size:52px;font-weight:bold">${tr('pdf.year.image.coverLine2')}</div>
      <div style="font-size:28px;color:${img.textSecondary};margin-top:20px">${tr('pdf.year.image.coverSubtitle')}</div>
    </div>
  `, themeId))

  // Slide 2: Total stats
  slides.push(await renderSlide(`
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:32px">
      <div style="font-size:28px;color:${img.textSecondary}">${tr('pdf.year.image.wroteThisYear', { year: data.year })}</div>
      <div style="font-size:80px;font-weight:bold;color:${img.statValueColor}">${data.totalSymbols.toLocaleString(intlLocale())}</div>
      <div style="font-size:36px">${tr('pdf.year.image.symbols')}</div>
      <div style="font-size:28px;color:${img.textSecondary};margin-top:16px">${getSymbolsComparison(data.totalSymbols)}</div>
      <div style="font-size:24px;color:${img.textSecondary}">${tr('pdf.year.image.sessionsActiveDays', { sessions: data.totalSessions, days: data.activeDays })}</div>
    </div>
  `, themeId))

  // Slide 3: Calendar heatmap (simplified monthly bars)
  const maxMonthly = Math.max(...data.monthlySymbols, 1)
  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(intlLocale(), { month: 'short' }))
  const barsHtml = data.monthlySymbols.map((sym, i) => {
    const pct = (sym / maxMonthly) * 100
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1">
      <div style="width:100%;height:${pct * 2.5}px;background:${img.accent};border-radius:6px;min-height:4px"></div>
      <div style="font-size:14px;color:${img.textSecondary}">${monthNames[i]}</div>
    </div>`
  }).join('')

  const busiestMonth = data.monthlySymbols.indexOf(maxMonthly)
  slides.push(await renderSlide(`
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;width:100%">
      <div style="font-size:36px;font-weight:bold">${tr('pdf.year.image.byMonths')}</div>
      <div style="display:flex;gap:8px;align-items:flex-end;height:300px;width:100%">${barsHtml}</div>
      <div style="font-size:24px;color:${img.textSecondary}">${tr('pdf.year.image.busiestMonth', { month: monthNames[busiestMonth], value: data.monthlySymbols[busiestMonth].toLocaleString(intlLocale()) })}</div>
    </div>
  `, themeId))

  // Slide 4: Best day
  if (data.bestDay) {
    const bestDayStr = new Date(data.bestDay.date).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long' })
    slides.push(await renderSlide(`
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        <div style="font-size:28px;color:${img.textSecondary}">${tr('pdf.year.image.bestDayTitle')}</div>
        <div style="font-size:48px;font-weight:bold">${bestDayStr}</div>
        <div style="font-size:72px;font-weight:bold;color:${img.statValueColor}">${data.bestDay.symbols.toLocaleString(intlLocale())}</div>
        <div style="font-size:32px">${tr('pdf.year.image.symbolsOneDay')}</div>
        <div style="font-size:64px;margin-top:16px">🏆</div>
      </div>
    `, themeId))
  }

  // Slide 5: Streak
  if (data.longestStreak > 0) {
    slides.push(await renderSlide(`
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        <div style="font-size:96px">🔥</div>
        <div style="font-size:28px;color:${img.textSecondary}">${tr('pdf.year.image.recordTitle')}</div>
        <div style="font-size:80px;font-weight:bold;color:${img.statValueColor}">${data.longestStreak}</div>
        <div style="font-size:36px">${tr('pdf.year.image.daysInRow')}</div>
      </div>
    `, themeId))
  }

  // Slide 6: Mood
  if (data.topMood) {
    slides.push(await renderSlide(`
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        <div style="font-size:28px;color:${img.textSecondary}">${tr('pdf.year.image.moodMost')}</div>
        <div style="font-size:56px;font-weight:bold">${tr('pdf.year.image.moodValue', { mood: escapeHtml(data.topMood.mood) })}</div>
        <div style="font-size:32px;color:${img.textSecondary}">${tr('pdf.year.image.moodPercent', { percent: data.topMood.percentage })}</div>
      </div>
    `, themeId))
  }

  // Slide 7: Projects
  if (data.projects.length > 0) {
    const projHtml = data.projects.slice(0, 5).map(p => {
      return `<div style="font-size:28px">${tr('pdf.year.image.projectLine', { title: escapeHtml(p.title), check: p.completed ? '✅' : '', value: p.symbols.toLocaleString(intlLocale()) })}</div>`
    }).join('')
    slides.push(await renderSlide(`
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px">
        <div style="font-size:36px;font-weight:bold;margin-bottom:16px">${tr('pdf.year.image.projectsTitle')}</div>
        ${projHtml}
      </div>
    `, themeId))
  }

  // Slide 8: Closing
  slides.push(await renderSlide(`
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
      <div style="font-size:64px">✨</div>
      <div style="font-size:40px;font-weight:bold">${tr('pdf.year.image.closingLine1')}</div>
      <div style="font-size:40px;font-weight:bold">${tr('pdf.year.image.closingLine2')}</div>
      <div style="font-size:28px;color:${img.textSecondary};margin-top:24px">${tr('pdf.year.image.closingNext', { year: data.year + 1 })}</div>
    </div>
  `, themeId))

  return slides
}

// ========== Multi-page PDF ==========

export async function generateYearInReviewPDF(
  data: YearInReviewData,
  themeId: ThemeId = 'clean'
): Promise<jsPDF> {
  const theme = getTheme(themeId)
  const pdf = theme.pdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const cx = PAGE_WIDTH / 2

  // Page 1: Cover
  for (let i = 0; i < PAGE_HEIGHT; i += 2) {
    const ratio = i / PAGE_HEIGHT
    doc.setFillColor(
      pdf.headerBg[0] * (1 - ratio * 0.3),
      pdf.headerBg[1] * (1 - ratio * 0.3),
      pdf.headerBg[2] * (1 - ratio * 0.3)
    )
    doc.rect(0, i, PAGE_WIDTH, 2, 'F')
  }

  doc.setTextColor(pdf.headerText[0], pdf.headerText[1], pdf.headerText[2])
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(48)
  doc.text(`${data.year}`, cx, 100, { align: 'center' })
  doc.setFontSize(28)
  doc.text(tr('pdf.year.coverTitle'), cx, 130, { align: 'center' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(14)
  doc.text(tr('pdf.year.coverSubtitle'), cx, 150, { align: 'center' })

  // Page 2: Stats
  doc.addPage()
  let y = 30
  y = addText(doc, tr('pdf.year.title', { year: data.year }), cx, y, { align: 'center', fontSize: 24, fontStyle: 'bold', color: pdf.accent })
  y += 10

  y = addText(doc, tr('pdf.year.written', { value: formatNumber(data.totalSymbols) }), MARGIN, y, { fontSize: 14, color: pdf.text })
  y = addText(doc, `(${getSymbolsComparison(data.totalSymbols)})`, MARGIN + 5, y, { fontSize: 12, color: pdf.textSecondary })
  y += 3
  y = addText(doc, tr('pdf.year.focusSessions', { count: data.totalSessions }), MARGIN, y, { fontSize: 14, color: pdf.text })
  y = addText(doc, tr('pdf.year.activeDays', { count: data.activeDays }), MARGIN, y, { fontSize: 14, color: pdf.text })
  y = addText(doc, tr('pdf.year.totalTime', { hours: Math.round(data.totalDuration / 60) }), MARGIN, y, { fontSize: 14, color: pdf.text })
  y = addText(doc, tr('pdf.year.longestStreak', { count: data.longestStreak }), MARGIN, y, { fontSize: 14, color: pdf.text })
  y += 8

  if (data.bestDay) {
    y = addText(doc, tr('pdf.year.bestDay'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.accent })
    y = addText(doc, tr('pdf.year.bestDayLine', { date: formatDateRu(data.bestDay.date), value: formatNumber(data.bestDay.symbols) }), MARGIN, y, { fontSize: 13, color: pdf.text })
    y += 8
  }

  if (data.topMood) {
    y = addText(doc, tr('pdf.year.moodOfYear'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.accent })
    y = addText(doc, tr('pdf.year.moodLine', { mood: data.topMood.mood, percent: data.topMood.percentage }), MARGIN, y, { fontSize: 13, color: pdf.text })
    y += 8
  }

  // Monthly breakdown — горизонтальные бары вместо текстового списка
  y = addText(doc, tr('pdf.year.byMonths'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.accent })
  y += 4
  const monthNamesShort = Array.from({ length: 12 }, (_, i) => {
    const n = new Date(2024, i, 1).toLocaleDateString(intlLocale(), { month: 'short' })
    return n.charAt(0).toUpperCase() + n.slice(1).replace('.', '')
  })
  const maxMonth = Math.max(...data.monthlySymbols, 1)
  const barMaxW = 110
  const barH = 5.2
  const rowH = 7.4
  doc.setFontSize(9)
  for (let i = 0; i < 12; i++) {
    const value = data.monthlySymbols[i]
    const w = Math.max((value / maxMonth) * barMaxW, value > 0 ? 1.5 : 0)
    // подпись месяца
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(pdf.text[0], pdf.text[1], pdf.text[2])
    doc.text(monthNamesShort[i], MARGIN + 14, y + barH - 1, { align: 'right' })
    // фон бара
    doc.setFillColor(pdf.border[0], pdf.border[1], pdf.border[2])
    doc.roundedRect(MARGIN + 17, y, barMaxW, barH, 1.2, 1.2, 'F')
    // бар (лучший месяц — акцентнее)
    const isBest = value === maxMonth && value > 0
    doc.setFillColor(pdf.accent[0], pdf.accent[1], pdf.accent[2])
    if (w > 0) doc.roundedRect(MARGIN + 17, y, w, barH, 1.2, 1.2, 'F')
    // значение справа от бара
    doc.setTextColor(pdf.textSecondary[0], pdf.textSecondary[1], pdf.textSecondary[2])
    if (isBest) doc.setFont('Roboto', 'bold')
    doc.text(formatNumber(value), MARGIN + 17 + barMaxW + 4, y + barH - 1)
    doc.setFont('Roboto', 'normal')
    y += rowH
  }
  y += 5

  // Projects
  if (data.projects.length > 0) {
    y = addText(doc, tr('pdf.year.projects'), MARGIN, y, { fontSize: 16, fontStyle: 'bold', color: pdf.accent })
    y += 3
    for (const p of data.projects) {
      // эмодзи нет в Roboto-шрифте PDF — текстовые пометки
      const status = p.completed ? `(${tr('pdf.year.completedMark')})` : `(${tr('pdf.year.inProgress')})`
      y = addText(doc, tr('pdf.year.projectLine', { title: p.title, value: formatNumber(p.symbols), status }), MARGIN + 5, y, { fontSize: 11, color: pdf.text })
    }
  }

  // Footer — напрямую, без addText: тот переносит страницу при y у нижнего края,
  // и бренд-строка улетала на пустую новую страницу
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(pdf.textSecondary[0], pdf.textSecondary[1], pdf.textSecondary[2])
  doc.text(tr('pdf.brand'), cx, PAGE_HEIGHT - 20, { align: 'center' })

  return doc
}
