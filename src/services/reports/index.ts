/**
 * Reports module index — re-exports everything for clean imports.
 */
import type { ThemeId } from './reportThemes'

// Types
export type { ThemeId, ReportTheme } from './reportThemes'
export { themes, getTheme } from './reportThemes'

// Session card
export type { SessionData } from './sessionCard'
export { generateSessionImage, generateSessionStoryImage, generateSessionPDF, getSessionTextForCopy } from './sessionCard'

// Report types
export { generateDailyReport, generateDailyImage, generateDailyStoryImage } from './dailyReport'
export { generateWeeklyReport } from './weeklyReport'
export { generateMonthlyReport } from './monthlyReport'
export { generateProjectReport } from './projectReport'

// Special reports
export type { WriterPassportData } from './writerPassport'
export { generateWriterPassportPDF, generateWriterPassportImage } from './writerPassport'
export type { YearInReviewData } from './yearInReview'
export { generateYearInReviewSlides, generateYearInReviewPDF } from './yearInReview'

// Smart insights
export type { Insight } from './smartInsights'
export { generateInsights } from './smartInsights'

// Shared sections (for backward compat and direct use)
export {
  addText, checkAndAddPage, addThemedHeader, addThemedFooter, addPageNumbers,
  addDivider, formatDuration, formatNumber, formatDateRu,
  getMoodLabel, formatSessionDate,
  addProgressChart, addCalendarHeatmap, addWeekdayDynamics,
  addTimeDistribution, addSessionsTable, addMoodsAnalysis,
  addMoodProductivityCorrelation, addOptimalTime,
  addAchievements, addRecords, addPeriodComparison,
  addNotes, addProgressToGoal, addProjectContext, addGeneralContext,
  addCertificateHeader, addKeyInsights, addQRCode, addTableOfContents,
  shouldIncludeSection,
  calculateCurrentStreak, calculateLongestStreak, calculateAchievements, calculateRecords,
  renderHtmlToImage, createImageContainer, downloadDataUrl,
} from './reportSections'

// ========== Shared types for new report config ==========

export interface NewReportConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'project'
  theme?: ThemeId
  projectId?: string
  period?: {
    from: string
    to: string
  }
  sections?: {
    progressChart?: boolean
    calendarHeatmap?: boolean
    weekdayDynamics?: boolean
    timeDistribution?: boolean
    detailedSessions?: boolean
    moods?: boolean
    moodCorrelation?: boolean
    optimalTime?: boolean
    achievements?: boolean
    records?: boolean
    periodComparison?: boolean
    notes?: boolean
  }
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

