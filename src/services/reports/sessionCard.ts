/**
 * Session micro-report: beautiful card for social sharing + clean PDF for print.
 * Supports 1080x1080 (square), 1080x1920 (stories), and A4 PDF formats.
 */
import jsPDF from 'jspdf'
import type { ThemeId } from './reportThemes'
import { getTheme } from './reportThemes'
import {
  addText, addThemedFooter, addPageNumbers, addQRCode, formatDuration, formatSessionDate,
  formatNumber, PAGE_WIDTH, tr, escapeHtml,
  createImageContainer, renderHtmlToImage
} from './reportSections'
import { getSessionTags, formatTags } from '../../config/appConfig'
import { intlLocale } from '../../i18n/dateLocale'
import '../pdfFontSetup'

export interface SessionData {
  id: string
  date: string
  duration: number
  plannedDuration: number
  symbols: number
  speed: number
  mood?: string
  tags?: string[]
  note?: string
  projectId?: string
  projectTitle?: string
  streak?: number
  projectProgress?: number
}

// ========== Image generation ==========

function buildCardHtml(data: SessionData, theme: ReturnType<typeof getTheme>, isStories: boolean): string {
  const img = theme.image
  const dateStr = new Date(data.date).toLocaleDateString(intlLocale(), {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  const tags = getSessionTags(data)
  const tagsStr = formatTags(tags)
  const hShort = tr('pdf.session.hoursShort')
  const mShort = tr('pdf.session.minShort')

  const cardBg = img.cardBg
  const cardBorder = img.cardBorder
  const textColor = img.text
  const secondaryColor = img.textSecondary
  const statColor = img.statValueColor
  const footerColor = img.footerColor

  const statCardStyle = `background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;padding:${isStories ? '24px 20px' : '20px 24px'};text-align:center;flex:1`
  const statValueStyle = `font-size:${isStories ? '48px' : '56px'};font-weight:bold;color:${statColor};line-height:1.1`
  const statLabelStyle = `font-size:${isStories ? '16px' : '18px'};color:${secondaryColor};margin-top:4px`

  const statsGrid = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:${isStories ? '16px' : '20px'};width:100%">
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${formatNumber(data.symbols)}</div>
        <div style="${statLabelStyle}">${tr('pdf.session.symbols')}</div>
      </div>
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${data.duration >= 60 ? Math.floor(data.duration / 60) + hShort + ' ' + (data.duration % 60 > 0 ? (data.duration % 60) + mShort : '') : data.duration}</div>
        <div style="${statLabelStyle}">${tr('pdf.session.minutes')}</div>
      </div>
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${data.speed.toFixed(1)}</div>
        <div style="${statLabelStyle}">${tr('pdf.session.charsPerMin')}</div>
      </div>
      <div style="${statCardStyle}">
        <div style="${statValueStyle}">${escapeHtml(tagsStr) || '🎯'}</div>
        <div style="${statLabelStyle}">${tagsStr ? tr('pdf.session.tags') : tr('pdf.session.focus')}</div>
      </div>
    </div>
  `

  const extras: string[] = []
  if (data.streak && data.streak > 1) {
    extras.push(`<div style="font-size:${isStories ? '28px' : '32px'};color:${textColor}">${tr('pdf.session.streakDays', { count: data.streak })}</div>`)
  }
  if (data.projectTitle && data.projectProgress !== undefined) {
    extras.push(`<div style="font-size:${isStories ? '24px' : '28px'};color:${secondaryColor}">${tr('pdf.session.project', { title: escapeHtml(data.projectTitle), progress: data.projectProgress })}</div>`)
  } else if (data.projectTitle) {
    extras.push(`<div style="font-size:${isStories ? '24px' : '28px'};color:${secondaryColor}">${tr('pdf.session.projectNoProgress', { title: escapeHtml(data.projectTitle) })}</div>`)
  }

  return `
    <div style="text-align:center;color:${textColor}">
      <div style="font-size:${isStories ? '36px' : '48px'};font-weight:bold;letter-spacing:2px;margin-bottom:8px">${tr('pdf.session.completed')}</div>
      <div style="font-size:${isStories ? '22px' : '26px'};color:${secondaryColor}">${dateStr}</div>
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

/** Generate session card image (1080x1080 square format) */
export async function generateSessionImage(
  data: SessionData,
  themeId: ThemeId = 'clean'
): Promise<string> {
  const theme = getTheme(themeId)
  const container = createImageContainer(1080, 1080, theme.image.gradient)
  container.style.color = theme.image.text
  container.innerHTML = buildCardHtml(data, theme, false)
  return renderHtmlToImage(container, 1080, 1080)
}

/** Generate session card image (1080x1920 stories format) */
export async function generateSessionStoryImage(
  data: SessionData,
  themeId: ThemeId = 'clean'
): Promise<string> {
  const theme = getTheme(themeId)
  const container = createImageContainer(1080, 1920, theme.image.gradient)
  container.style.color = theme.image.text
  container.style.padding = '80px 60px'
  container.innerHTML = buildCardHtml(data, theme, true)
  return renderHtmlToImage(container, 1080, 1920)
}

// ========== PDF generation ==========

/** Generate clean A4 PDF session micro-report for print */
export async function generateSessionPDF(
  data: SessionData,
  themeId: ThemeId = 'clean'
): Promise<jsPDF> {
  const theme = getTheme(themeId)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pdf = theme.pdf

  // Header band
  doc.setFillColor(pdf.headerBg[0], pdf.headerBg[1], pdf.headerBg[2])
  doc.rect(0, 0, PAGE_WIDTH, 50, 'F')

  addText(doc, tr('pdf.session.completed'), PAGE_WIDTH / 2, 22, {
    align: 'center', fontSize: 28, fontStyle: 'bold', color: pdf.headerText
  })

  const dateStr = new Date(data.date).toLocaleDateString(intlLocale(), {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  addText(doc, dateStr, PAGE_WIDTH / 2, 38, {
    align: 'center', fontSize: 14, color: pdf.headerText
  })

  let y = 70

  // Large stat cards
  const cardW = 75
  const cardH = 35
  const gap = 10
  const startX = (PAGE_WIDTH - 2 * cardW - gap) / 2

  // Card 1: Symbols
  drawStatCard(doc, startX, y, cardW, cardH, formatNumber(data.symbols), tr('pdf.session.symbols'), pdf)
  // Card 2: Duration
  drawStatCard(doc, startX + cardW + gap, y, cardW, cardH, formatDuration(data.duration), tr('pdf.session.time'), pdf)

  y += cardH + gap

  // Card 3: Speed
  drawStatCard(doc, startX, y, cardW, cardH, `${data.speed.toFixed(1)}`, tr('pdf.session.charsPerMin'), pdf)
  // Card 4: Tags/Focus
  const pdfTags = getSessionTags(data)
  const pdfTagsStr = pdfTags.length > 0 ? formatTags(pdfTags) : tr('pdf.session.focusValue')
  drawStatCard(doc, startX + cardW + gap, y, cardW, cardH, pdfTagsStr, pdfTags.length > 0 ? tr('pdf.session.tags') : tr('pdf.session.focus'), pdf)

  y += cardH + 15

  // Divider
  doc.setDrawColor(pdf.border[0], pdf.border[1], pdf.border[2])
  doc.setLineWidth(0.5)
  doc.line(30, y, PAGE_WIDTH - 30, y)
  y += 12

  // Extras
  if (data.streak && data.streak > 1) {
    y = addText(doc, tr('pdf.session.streakDays', { count: data.streak }), PAGE_WIDTH / 2, y, {
      align: 'center', fontSize: 16, fontStyle: 'bold', color: pdf.text
    })
    y += 3
  }

  if (data.projectTitle) {
    const projText = data.projectProgress !== undefined
      ? tr('pdf.session.project', { title: data.projectTitle, progress: data.projectProgress })
      : tr('pdf.session.projectNoProgress', { title: data.projectTitle })
    y = addText(doc, projText, PAGE_WIDTH / 2, y, {
      align: 'center', fontSize: 14, color: pdf.textSecondary
    })
    y += 3
  }

  if (data.note) {
    y += 5
    y = addText(doc, tr('pdf.session.note', { note: data.note }), 30, y, {
      fontSize: 11, color: pdf.textSecondary, maxWidth: 150
    })
  }

  // QR code
  y = await addQRCode(doc, y + 5)

  // Footer
  addThemedFooter(doc, theme)
  addPageNumbers(doc, theme)

  return doc
}

function drawStatCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: string, label: string,
  pdf: ReturnType<typeof getTheme>['pdf']
): void {
  doc.setFillColor(pdf.cardBg[0], pdf.cardBg[1], pdf.cardBg[2])
  doc.roundedRect(x, y, w, h, 3, 3, 'F')
  doc.setDrawColor(pdf.border[0], pdf.border[1], pdf.border[2])
  doc.roundedRect(x, y, w, h, 3, 3, 'S')

  // Value
  doc.setFontSize(18)
  doc.setFont('Roboto', 'bold')
  doc.setTextColor(pdf.accent[0], pdf.accent[1], pdf.accent[2])
  doc.text(value, x + w / 2, y + h / 2 - 2, { align: 'center' })

  // Label
  doc.setFontSize(10)
  doc.setFont('Roboto', 'normal')
  doc.setTextColor(pdf.textSecondary[0], pdf.textSecondary[1], pdf.textSecondary[2])
  doc.text(label, x + w / 2, y + h / 2 + 10, { align: 'center' })
}

// ========== Text for copy ==========

export function getSessionTextForCopy(data: SessionData): string {
  const dateStr = formatSessionDate(data.date)
  const durationStr = formatDuration(data.duration)
  const tags = getSessionTags(data)

  let text = `${tr('pdf.session.completed')}\n\n`
  text += `${dateStr}\n\n`
  text += `${tr('pdf.session.textSymbols', { value: formatNumber(data.symbols) })}\n`
  text += `⏰ ${durationStr}\n`
  text += `${tr('pdf.session.textSpeed', { value: data.speed.toFixed(1) })}\n\n`
  if (tags.length > 0) text += `${formatTags(tags)}\n\n`
  if (data.note) text += `${tr('pdf.session.note', { note: data.note })}\n\n`
  if (data.projectTitle) text += `${tr('pdf.session.textProject', { project: data.projectTitle })}\n\n`
  if (data.streak && data.streak > 1) text += `${tr('pdf.session.streakDays', { count: data.streak })}\n\n`
  text += tr('pdf.brand')
  return text
}
