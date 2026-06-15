/**
 * Writer's Passport: beautiful one-page certificate/portfolio.
 * Available as PDF and image.
 */
import jsPDF from 'jspdf'
import type { ThemeId } from './reportThemes'
import { getTheme } from './reportThemes'
import {
  addText, addPageNumbers, formatNumber, formatDateRu,
  PAGE_WIDTH, PAGE_HEIGHT, tr, escapeHtml,
  createImageContainer, renderHtmlToImage,
} from './reportSections'
import { intlLocale } from '../../i18n/dateLocale'
import '../pdfFontSetup'

export interface WriterPassportData {
  authorName: string
  registrationDate: string
  totalSymbols: number
  totalSessions: number
  activeDays: number
  currentStreak: number
  longestStreak: number
  projects: Array<{
    title: string
    symbols: number
    targetSymbols: number
    completed: boolean
  }>
  achievements: Array<{ emoji: string; title: string }>
}

// ========== PDF version ==========

export async function generateWriterPassportPDF(
  data: WriterPassportData,
  themeId: ThemeId = 'clean'
): Promise<jsPDF> {
  const theme = getTheme(themeId)
  const pdf = theme.pdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const cx = PAGE_WIDTH / 2

  // Decorative border
  doc.setDrawColor(pdf.accent[0], pdf.accent[1], pdf.accent[2])
  doc.setLineWidth(2)
  doc.rect(12, 12, PAGE_WIDTH - 24, PAGE_HEIGHT - 24, 'S')
  doc.setLineWidth(0.5)
  doc.rect(15, 15, PAGE_WIDTH - 30, PAGE_HEIGHT - 30, 'S')

  // Title
  let y = 35
  doc.setFontSize(28)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(pdf.accent[0], pdf.accent[1], pdf.accent[2])
  doc.text(tr('pdf.passport.title'), cx, y, { align: 'center' })

  // Decorative line
  y += 8
  doc.setDrawColor(pdf.accent[0], pdf.accent[1], pdf.accent[2])
  doc.setLineWidth(1)
  doc.line(60, y, PAGE_WIDTH - 60, y)

  // Author info
  y += 15
  y = addText(doc, tr('pdf.passport.name', { name: data.authorName }), cx, y, { align: 'center', fontSize: 14, color: pdf.text })
  y = addText(doc, tr('pdf.passport.registration', { date: formatDateRu(data.registrationDate) }), cx, y, { align: 'center', fontSize: 11, color: pdf.textSecondary })
  y += 5

  // Section: Stats
  doc.setDrawColor(pdf.border[0], pdf.border[1], pdf.border[2])
  doc.setLineWidth(0.5)
  doc.line(30, y, PAGE_WIDTH - 30, y)
  y += 8
  y = addText(doc, tr('pdf.passport.achievements'), cx, y, { align: 'center', fontSize: 16, fontStyle: 'bold', color: pdf.text })
  y += 5

  const completedProjects = data.projects.filter(p => p.completed).length
  const stats = [
    [tr('pdf.passport.projectsCompleted', { count: completedProjects }), tr('pdf.passport.written', { value: formatNumber(data.totalSymbols) })],
    [tr('pdf.passport.bestStreak', { count: data.longestStreak }), tr('pdf.passport.activeDays', { count: data.activeDays })],
    [tr('pdf.passport.focusSessions', { count: data.totalSessions }), tr('pdf.passport.currentStreak', { count: data.currentStreak })],
  ]

  for (const row of stats) {
    doc.setFontSize(11)
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(pdf.text[0], pdf.text[1], pdf.text[2])
    doc.text(row[0], 40, y)
    doc.text(row[1], 120, y)
    y += 7
  }
  y += 5

  // Section: Achievements/Awards
  if (data.achievements.length > 0) {
    doc.line(30, y, PAGE_WIDTH - 30, y)
    y += 8
    y = addText(doc, tr('pdf.passport.awards'), cx, y, { align: 'center', fontSize: 16, fontStyle: 'bold', color: pdf.text })
    y += 3

    const achPerRow = 3
    for (let i = 0; i < Math.min(data.achievements.length, 9); i += achPerRow) {
      const row = data.achievements.slice(i, i + achPerRow)
      const rowWidth = row.length * 55
      let x = (PAGE_WIDTH - rowWidth) / 2 + 25
      for (const ach of row) {
        doc.setFontSize(10)
        doc.setFont('Roboto', 'normal')
        doc.setTextColor(pdf.text[0], pdf.text[1], pdf.text[2])
        doc.text(`${ach.emoji} ${ach.title}`, x, y, { align: 'center' })
        x += 55
      }
      y += 8
    }
    y += 3
  }

  // Section: Projects
  if (data.projects.length > 0) {
    doc.line(30, y, PAGE_WIDTH - 30, y)
    y += 8
    y = addText(doc, tr('pdf.passport.projects'), cx, y, { align: 'center', fontSize: 16, fontStyle: 'bold', color: pdf.text })
    y += 3

    for (const proj of data.projects.slice(0, 8)) {
      const progress = proj.targetSymbols > 0 ? Math.round((proj.symbols / proj.targetSymbols) * 100) : 100
      const status = proj.completed ? '✅' : `${progress}%`
      y = addText(doc, tr('pdf.passport.projectLine', { title: proj.title, value: formatNumber(proj.symbols), status }), 35, y, { fontSize: 11, color: pdf.text })
    }
    y += 5
  }

  // Footer
  doc.setDrawColor(pdf.border[0], pdf.border[1], pdf.border[2])
  doc.setLineWidth(0.5)
  doc.line(60, PAGE_HEIGHT - 35, PAGE_WIDTH - 60, PAGE_HEIGHT - 35)

  addText(doc, tr('pdf.brand'), cx, PAGE_HEIGHT - 28, { align: 'center', fontSize: 11, color: pdf.textSecondary })
  const now = new Date().toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric' })
  addText(doc, now.charAt(0).toUpperCase() + now.slice(1), cx, PAGE_HEIGHT - 22, { align: 'center', fontSize: 10, color: pdf.textSecondary })

  addPageNumbers(doc, theme)
  return doc
}

// ========== Image version (1080x1080) ==========

export async function generateWriterPassportImage(
  data: WriterPassportData,
  themeId: ThemeId = 'clean'
): Promise<string> {
  const theme = getTheme(themeId)
  const img = theme.image
  const container = createImageContainer(1080, 1080, img.gradient)
  container.style.color = img.text
  container.style.padding = '50px'

  const completedProjects = data.projects.filter(p => p.completed).length

  const achievementBadges = data.achievements.slice(0, 6)
    .map(a => `<span style="background:${img.cardBg};border:1px solid ${img.cardBorder};border-radius:12px;padding:6px 14px;font-size:18px">${a.emoji} ${a.title}</span>`)
    .join(' ')

  const projectLines = data.projects.slice(0, 4)
    .map(p => {
      const progress = p.targetSymbols > 0 ? Math.round((p.symbols / p.targetSymbols) * 100) : 100
      return `<div style="font-size:22px;color:${img.textSecondary}">${tr('pdf.passport.projectLine', { title: escapeHtml(p.title), value: p.symbols.toLocaleString(intlLocale()), status: p.completed ? '✅' : `(${progress}%)` })}</div>`
    }).join('')

  container.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:36px;font-weight:bold;letter-spacing:3px">${tr('pdf.passport.title')}</div>
      <div style="width:100px;height:3px;background:${img.accent};margin:12px auto"></div>
      <div style="font-size:22px;color:${img.textSecondary};margin-top:8px">${escapeHtml(data.authorName)}</div>
    </div>

    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:${img.cardBg};border:1px solid ${img.cardBorder};border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:36px;font-weight:bold;color:${img.statValueColor}">${data.totalSymbols.toLocaleString(intlLocale())}</div>
          <div style="font-size:16px;color:${img.textSecondary}">${tr('pdf.passport.symbolsLabel')}</div>
        </div>
        <div style="background:${img.cardBg};border:1px solid ${img.cardBorder};border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:36px;font-weight:bold;color:${img.statValueColor}">${completedProjects}</div>
          <div style="font-size:16px;color:${img.textSecondary}">${tr('pdf.passport.projectsLabel')}</div>
        </div>
        <div style="background:${img.cardBg};border:1px solid ${img.cardBorder};border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:36px;font-weight:bold;color:${img.statValueColor}">${data.longestStreak}</div>
          <div style="font-size:16px;color:${img.textSecondary}">${tr('pdf.passport.streakLabel')}</div>
        </div>
        <div style="background:${img.cardBg};border:1px solid ${img.cardBorder};border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:36px;font-weight:bold;color:${img.statValueColor}">${data.activeDays}</div>
          <div style="font-size:16px;color:${img.textSecondary}">${tr('pdf.passport.activeDaysLabel')}</div>
        </div>
      </div>

      ${achievementBadges ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">${achievementBadges}</div>` : ''}
      ${projectLines ? `<div style="display:flex;flex-direction:column;gap:4px">${projectLines}</div>` : ''}
    </div>

    <div style="text-align:center;color:${img.footerColor}">
      <div style="width:60%;margin:0 auto;border-top:1px solid ${img.cardBorder};padding-top:12px"></div>
      <div style="font-size:18px">${tr('pdf.brand')}</div>
    </div>
  `

  return renderHtmlToImage(container, 1080, 1080)
}
