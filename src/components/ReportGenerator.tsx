import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import type { NewReportConfig, ReportData } from '../services/reports/index'
import { downloadDataUrl } from '../services/reports/reportUtils'
import type { ThemeId } from '../services/reports/reportThemes'
import { getEntries, getSessions, getProjects, getNotes, type Project } from '../services/databaseService'

type ReportType = 'daily' | 'weekly' | 'monthly' | 'project'
type QuickPeriod = 'today' | 'thisWeek' | 'thisMonth' | 'last7Days' | 'last30Days' | 'all'
type DailyFormat = 'pdf' | 'image' | 'story'

const REPORT_TYPES: { id: ReportType; icon: string }[] = [
  { id: 'daily', icon: '📅' },
  { id: 'weekly', icon: '📊' },
  { id: 'monthly', icon: '📈' },
  { id: 'project', icon: '📚' },
]

const THEMES: { id: ThemeId; preview: string }[] = [
  { id: 'clean', preview: 'bg-gray-100 text-gray-800' },
  { id: 'dark', preview: 'bg-gray-900 text-cyan-400' },
]

const QUICK_PERIODS: { id: QuickPeriod }[] = [
  { id: 'today' },
  { id: 'thisWeek' },
  { id: 'thisMonth' },
  { id: 'last7Days' },
  { id: 'last30Days' },
  { id: 'all' },
]

function ReportGenerator() {
  const { t } = useTranslation()
  const [reportType, setReportType] = useState<ReportType>('daily')
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>('clean')
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('today')
  const [periodFrom, setPeriodFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [periodTo, setPeriodTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [projectId, setProjectId] = useState<string | undefined>(undefined)

  const [projects, setProjects] = useState<Project[]>([])
  const [dailyFormat, setDailyFormat] = useState<DailyFormat>('pdf')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    getProjects().then(setProjects)
  }, [])

  const handleQuickPeriod = (period: QuickPeriod) => {
    setQuickPeriod(period)
    const today = new Date()
    let from = today
    let to = today

    switch (period) {
      case 'today':
        break
      case 'thisWeek':
        from = startOfWeek(today, { weekStartsOn: 1 })
        to = endOfWeek(today, { weekStartsOn: 1 })
        break
      case 'thisMonth':
        from = startOfMonth(today)
        to = endOfMonth(today)
        break
      case 'last7Days':
        from = subDays(today, 7)
        break
      case 'last30Days':
        from = subDays(today, 30)
        break
      case 'all':
        from = new Date(2000, 0, 1)
        break
    }

    setPeriodFrom(format(from, 'yyyy-MM-dd'))
    setPeriodTo(format(to, 'yyyy-MM-dd'))
  }

  const handleSelectType = (type: ReportType) => {
    setReportType(type)
    // Auto-set period based on type
    if (type === 'daily') handleQuickPeriod('today')
    else if (type === 'weekly') handleQuickPeriod('thisWeek')
    else if (type === 'monthly') handleQuickPeriod('thisMonth')
    else if (type === 'project') handleQuickPeriod('all')
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const entries = await getEntries()
      const sessions = await getSessions()
      const projs = await getProjects()
      const notes = await getNotes()

      let effectiveFrom = periodFrom
      let effectiveTo = periodTo

      if (quickPeriod === 'all' && projectId) {
        const selectedProject = projs.find(p => p.id === projectId)
        if (selectedProject?.startDate) {
          effectiveFrom = selectedProject.startDate
          effectiveTo = format(new Date(), 'yyyy-MM-dd')
        }
      }

      const filteredEntries = entries.filter(e =>
        e.date >= effectiveFrom && e.date <= effectiveTo
      )
      const filteredSessions = sessions.filter(s => {
        const sessionDate = s.date.split('T')[0]
        return sessionDate >= effectiveFrom && sessionDate <= effectiveTo
      })

      const finalEntries = projectId
        ? filteredEntries.filter(e => e.projectId === projectId)
        : filteredEntries
      const finalSessions = projectId
        ? filteredSessions.filter(s => s.projectId === projectId)
        : filteredSessions

      const reportData: ReportData = {
        entries: finalEntries.map(e => ({ date: e.date, symbols: e.symbols, projectId: e.projectId })),
        sessions: finalSessions.map(s => ({
          date: s.date, duration: s.duration, symbols: s.symbols,
          speed: s.speed, mood: s.mood, projectId: s.projectId,
        })),
        projects: projs.map(p => ({
          id: p.id, title: p.title, genre: p.genre,
          targetSymbols: p.targetSymbols, startDate: p.startDate, deadline: p.deadline,
        })),
        notes: notes.map(n => ({ date: n.date, title: n.title, content: n.content })),
      }

      const config: NewReportConfig = {
        type: reportType,
        theme: selectedTheme,
        projectId,
        period: { from: effectiveFrom, to: effectiveTo },
      }

      // Генераторы тяжёлые (jspdf+шрифты) — грузим только при генерации
      const reports = await import('../services/reports/index')

      // Handle daily image formats
      if (reportType === 'daily' && dailyFormat !== 'pdf') {
        const dataUrl = dailyFormat === 'story'
          ? await reports.generateDailyStoryImage(effectiveFrom, reportData, selectedTheme, projectId)
          : await reports.generateDailyImage(effectiveFrom, reportData, selectedTheme, projectId)
        const suffix = dailyFormat === 'story' ? 'story' : 'card'
        downloadDataUrl(dataUrl, `knigotrek-daily-${suffix}-${effectiveFrom}.png`)
        return
      }

      let doc
      switch (reportType) {
        case 'daily':
          doc = await reports.generateDailyReport(effectiveFrom, reportData, config)
          break
        case 'weekly':
          doc = await reports.generateWeeklyReport(effectiveFrom, effectiveTo, reportData, config)
          break
        case 'monthly': {
          const fromDate = new Date(effectiveFrom)
          doc = await reports.generateMonthlyReport(fromDate.getMonth() + 1, fromDate.getFullYear(), reportData, config)
          break
        }
        case 'project':
          if (projectId) {
            doc = await reports.generateProjectReport(projectId, reportData, config)
          } else {
            doc = await reports.generateWeeklyReport(effectiveFrom, effectiveTo, reportData, config)
          }
          break
      }

      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(pdfUrl)
      setShowPreview(true)
    } catch (err) {
      console.error('Error generating report:', err)
      setError(t('reports:errorGenerating'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!previewUrl) return
    const link = document.createElement('a')
    link.href = previewUrl
    link.download = `knigotrek-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    link.click()
  }

  const closePreview = () => {
    setShowPreview(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        {t('reports:title')}
        <HelpTip text={t('common:help.reports')} />
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
        {/* Step 1: Report type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('reports:step1')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.id}
                onClick={() => handleSelectType(rt.id)}
                className={`flex flex-col items-center p-3 rounded-lg text-sm font-medium transition border-2 ${
                  reportType === rt.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-transparent bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="text-xl mb-1">{rt.icon}</span>
                <span>{t(`reports:types.${rt.id}.label`)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t(`reports:types.${rt.id}.desc`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Daily format selector */}
        {reportType === 'daily' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('reports:format.label')}
            </label>
            <div className="flex gap-2">
              {([
                { id: 'pdf' as DailyFormat, label: t('reports:format.pdf'), desc: t('reports:format.pdfDesc') },
                { id: 'image' as DailyFormat, label: t('reports:format.image'), desc: t('reports:format.imageDesc') },
                { id: 'story' as DailyFormat, label: t('reports:format.story'), desc: t('reports:format.storyDesc') },
              ]).map(f => (
                <button
                  key={f.id}
                  onClick={() => setDailyFormat(f.id)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition border-2 ${
                    dailyFormat === f.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-transparent bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <div>{f.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Period */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('reports:step2')}
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {QUICK_PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => handleQuickPeriod(p.id)}
                className={`px-3 py-2 rounded-lg text-sm transition ${
                  quickPeriod === p.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t(`reports:periods.${p.id}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('reports:from')}</label>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('reports:to')}</label>
              <input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Project (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('reports:step3')} {reportType !== 'project' && <span className="text-xs text-gray-400">{t('reports:optional')}</span>}
          </label>
          <select
            value={projectId || 'all'}
            onChange={(e) => setProjectId(e.target.value === 'all' ? undefined : e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">{t('reports:allProjects')}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Step 4: Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('reports:step4')}
          </label>
          <div className="flex gap-2">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition border-2 ${
                  selectedTheme === theme.id ? 'border-indigo-500 ring-1 ring-indigo-300' : 'border-transparent'
                } ${theme.preview}`}
              >
                <div>{t(`reports:themes.${theme.id}.label`)}</div>
                <div className="text-xs opacity-70 mt-0.5">{t(`reports:themes.${theme.id}.desc`)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          {error && (
            <div className="mb-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (reportType === 'project' && !projectId)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('reports:generating')}
                </span>
              ) : t('reports:generate')}
            </button>
            {previewUrl && (
              <button
                onClick={handleDownload}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                {t('reports:downloadPdf')}
              </button>
            )}
          </div>

          {reportType === 'project' && !projectId && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {t('reports:selectProjectHint')}
            </p>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closePreview}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('reports:previewTitle')}</h3>
              <button onClick={closePreview} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={previewUrl} className="w-full h-full min-h-[600px]" title="PDF Preview" />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition"
              >
                {t('reports:downloadPdf')}
              </button>
              <button
                onClick={closePreview}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                {t('actions.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportGenerator
