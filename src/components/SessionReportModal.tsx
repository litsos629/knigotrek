import { useState, useEffect } from 'react'
import { intlLocale } from '../i18n/dateLocale'
import { useTranslation } from 'react-i18next'
import type { SessionData } from '../services/reports/sessionCard'
import { downloadDataUrl } from '../services/reports/reportUtils'
import type { ThemeId } from '../services/reports/reportThemes'
import { getSessionTags, formatTags } from '../config/appConfig'
import { MANUAL_ACHIEVEMENTS } from '../data/achievements'
import { markManual, ALL_SCOPE } from '../services/achievementsService'

interface SessionReportModalProps {
  sessionData: SessionData
  isOpen: boolean
  onClose: () => void
}

type TabId = 'social' | 'print'
type ImageFormat = 'square' | 'stories'

function SessionReportModal({ sessionData, isOpen, onClose }: SessionReportModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabId>('social')
  const [imageFormat, setImageFormat] = useState<ImageFormat>('square')
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>('clean')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // Эмоциональные моменты, отмеченные в этой сессии (для галочки в чипах)
  const [marked, setMarked] = useState<Set<string>>(new Set())

  // Модалка остаётся смонтированной — без сброса при открытии висели бы старые сообщения
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setSuccessMessage(null)
      setMarked(new Set())
    }
  }, [isOpen])

  if (!isOpen) return null

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleMarkMoment = async (id: string) => {
    await markManual(id, sessionData.projectId || ALL_SCOPE)
    setMarked((prev) => new Set(prev).add(id))
    showSuccess(t('achievements:markedToast', { title: t(`achievements:creative.${id}.title`) }))
  }

  const handleDownloadImage = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      const dataUrl = imageFormat === 'stories'
        ? await (await import('../services/reports/sessionCard')).generateSessionStoryImage(sessionData, selectedTheme)
        : await (await import('../services/reports/sessionCard')).generateSessionImage(sessionData, selectedTheme)

      const suffix = imageFormat === 'stories' ? 'story' : 'card'
      downloadDataUrl(dataUrl, `session-${suffix}-${sessionData.date.split('T')[0]}.png`)
      showSuccess(t('focus:report.imageDownloaded'))
    } catch (err) {
      setError(t('focus:report.imageError'))
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      const doc = await (await import('../services/reports/sessionCard')).generateSessionPDF(sessionData, 'clean')
      doc.save(`session-report-${sessionData.date.split('T')[0]}.pdf`)
      showSuccess(t('focus:report.pdfDownloaded'))
    } catch (err) {
      setError(t('focus:report.pdfError'))
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleShare = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      if (navigator.share) {
        const { getSessionTextForCopy } = await import('../services/reports/sessionCard')
        const text = getSessionTextForCopy(sessionData)
        await navigator.share({ title: t('focus:report.shareTitle'), text })
      } else {
        await handleCopyText()
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(t('focus:report.shareError'))
        console.error(err)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyText = async () => {
    try {
      const { getSessionTextForCopy } = await import('../services/reports/sessionCard')
      const text = getSessionTextForCopy(sessionData)
      await navigator.clipboard.writeText(text)
      showSuccess(t('focus:report.textCopied'))
    } catch (err) {
      setError(t('focus:report.copyError'))
      console.error(err)
    }
  }

  const dateStr = new Date(sessionData.date).toLocaleDateString(intlLocale(), {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const durationStr = sessionData.duration >= 60
    ? `${Math.floor(sessionData.duration / 60)}${t('focus:report.hoursSuffix')} ${sessionData.duration % 60 > 0 ? `${sessionData.duration % 60}${t('focus:report.minutesSuffix')}` : ''}`
    : t('focus:minutes', { count: sessionData.duration })

  // Theme preview colors
  const themePreview: Record<ThemeId, { bg: string; text: string; label: string }> = {
    clean: { bg: 'bg-gray-100', text: 'text-gray-800', label: t('focus:report.themeClean') },
    dark: { bg: 'bg-gray-900', text: 'text-cyan-400', label: t('focus:report.themeDark') },
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-t-xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{t('focus:report.sessionComplete')}</h2>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
          </div>
          <p className="text-white/80 text-sm mt-1">{dateStr}</p>
        </div>

        <div className="p-5">
          {/* Live preview card */}
          <div className={`rounded-xl p-6 mb-5 ${
            selectedTheme === 'dark' ? 'bg-gray-900 text-gray-200' :
            'bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100'
          }`}>
            <div className="text-center mb-4">
              <div className={`text-lg font-bold tracking-wider ${
                selectedTheme === 'dark' ? 'text-cyan-400' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                {t('focus:report.sessionCompleteCaps')}
              </div>
              <div className={`text-sm mt-1 ${
                selectedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {dateStr}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const tags = getSessionTags(sessionData)
                const tagsStr = formatTags(tags)
                return [
                  { value: sessionData.symbols.toLocaleString(intlLocale()), label: t('focus:report.symbols') },
                  { value: durationStr, label: t('focus:report.time') },
                  { value: `${sessionData.speed.toFixed(1)}`, label: t('focus:report.speedUnit') },
                  { value: tagsStr || '🎯', label: tagsStr ? t('focus:report.tags') : t('focus:report.focus') },
                ]
              })().map((stat, i) => (
                <div key={i} className={`rounded-lg p-3 text-center ${
                  selectedTheme === 'dark' ? 'bg-white/5 border border-cyan-500/20' :
                  'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}>
                  <div className={`text-xl font-bold ${
                    selectedTheme === 'dark' ? 'text-cyan-400' : 'text-indigo-600 dark:text-indigo-400'
                  }`}>{stat.value}</div>
                  <div className={`text-xs ${
                    selectedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'
                  }`}>{stat.label}</div>
                </div>
              ))}
            </div>

            {sessionData.projectTitle && (
              <div className={`text-center mt-3 text-sm ${
                selectedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                📚 "{sessionData.projectTitle}"
                {sessionData.projectProgress !== undefined && ` — ${sessionData.projectProgress}%`}
              </div>
            )}

            {sessionData.streak && sessionData.streak > 1 && (
              <div className="text-center mt-2 text-sm font-medium">
                🔥 {t('focus:report.daysStreak', { count: sessionData.streak })}
              </div>
            )}
          </div>

          {/* Эмоциональные моменты сессии — отметить достижение (по желанию) */}
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('achievements:sessionMomentsTitle')}
            </div>
            <div className="flex flex-wrap gap-2">
              {MANUAL_ACHIEVEMENTS.map((a) => {
                const done = marked.has(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => handleMarkMoment(a.id)}
                    disabled={done}
                    title={t(`achievements:creative.${a.id}.desc`)}
                    className={`px-2.5 py-1 rounded-full text-xs transition ${
                      done
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700 cursor-default'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {a.emoji} {t(`achievements:creative.${a.id}.title`)}{done ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('social')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === 'social'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('focus:report.forSocial')}
            </button>
            <button
              onClick={() => setActiveTab('print')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === 'print'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('focus:report.forPrint')}
            </button>
          </div>

          {/* Social tab */}
          {activeTab === 'social' && (
            <div className="space-y-4">
              {/* Theme selection */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('focus:report.theme')}</label>
                <div className="flex gap-2">
                  {(Object.entries(themePreview) as [ThemeId, typeof themePreview['clean']][]).map(([id, t]) => (
                    <button
                      key={id}
                      onClick={() => setSelectedTheme(id)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition border-2 ${
                        selectedTheme === id ? 'border-indigo-500' : 'border-transparent'
                      } ${t.bg} ${t.text}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format toggle */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('focus:report.format')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImageFormat('square')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition ${
                      imageFormat === 'square' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {t('focus:report.formatPost')}
                  </button>
                  <button
                    onClick={() => setImageFormat('stories')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition ${
                      imageFormat === 'stories' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {t('focus:report.formatStory')}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                  <button
                    onClick={handleDownloadImage}
                    disabled={isGenerating}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {isGenerating ? t('focus:report.generating') : t('focus:report.downloadImage')}
                  </button>
                  {typeof navigator.share === 'function' && (
                    <button
                      onClick={handleShare}
                      disabled={isGenerating}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      {t('focus:report.share')}
                    </button>
                  )}
                </div>
            </div>
          )}

          {/* Print tab */}
          {activeTab === 'print' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('focus:report.printDescription')}
              </p>
              <button
                  onClick={handleDownloadPDF}
                  disabled={isGenerating}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isGenerating ? t('focus:report.generating') : t('focus:report.downloadPDF')}
                </button>
            </div>
          )}

          {/* Copy text button (always visible) */}
          <button
            onClick={handleCopyText}
            disabled={isGenerating}
            className="w-full mt-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {t('focus:report.copyText')}
          </button>

          {/* Status messages */}
          {error && (
            <div className="mt-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {t('actions.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionReportModal
