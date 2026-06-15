import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { dfnsLocale, formatNumber } from '../i18n/dateLocale'
import { getEntries, type Project } from '../services/databaseService'
import { getGenreLabel } from '../config/appConfig'

interface CompletedProjectCardProps {
  project: Project
  onUnfreeze?: (projectId: string) => void
  unfreezeDisabled?: boolean
  unfreezeReason?: string
}

function CompletedProjectCard({ project, onUnfreeze, unfreezeDisabled, unfreezeReason }: CompletedProjectCardProps) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState({ total: 0, percentage: 0 })
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    loadProgress()
  }, [project])

  const loadProgress = async () => {
    setLoading(true)
    try {
      const entries = await getEntries()
      const projectEntries = entries.filter(e => e.projectId === project.id)
      const total = projectEntries.reduce((sum, e) => sum + e.symbols, 0)
      const percentage = Math.min(Math.round((total / project.targetSymbols) * 100), 100)
      setProgress({ total, percentage })
    } catch (error) {
      console.error('Error loading progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-6">
        <p className="text-gray-500 dark:text-gray-400">{t('projects:completed.loading')}</p>
      </div>
    )
  }

  const unfreezeCount = project.unfreezeCount || 0

  return (
    <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {project.status === 'completed' ? '\u2705 ' : '\u23F8\uFE0F '}{project.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('projects:completed.stats', {
              genre: getGenreLabel(project.genre),
              total: formatNumber(progress.total),
              target: formatNumber(project.targetSymbols),
              percentage: progress.percentage
            })}
          </p>
          {project.completedDate && (
            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
              {t('projects:completed.completedDate', { date: format(new Date(project.completedDate), 'd MMMM yyyy', { locale: dfnsLocale() }) })}
            </p>
          )}
          {unfreezeCount > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t('projects:completed.unfreezeCount', { count: unfreezeCount })}
            </p>
          )}
        </div>

        {/* Меню действий */}
        <div className="relative ml-3">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition rounded-lg hover:bg-green-100 dark:hover:bg-green-800/30"
            aria-label={t('projects:completed.menu')}
          >
            {'\u22EF'}
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                {onUnfreeze && (
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      if (!unfreezeDisabled) {
                        onUnfreeze(project.id)
                      }
                    }}
                    disabled={unfreezeDisabled}
                    className={`w-full text-left px-4 py-2 text-sm transition ${
                      unfreezeDisabled
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={unfreezeReason}
                  >
                    {'\uD83D\uDD04'} {t('projects:completed.unfreeze')}
                    {unfreezeDisabled && unfreezeReason && (
                      <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{unfreezeReason}</span>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Прогресс-бар */}
      <div className="mt-3">
        <div className="w-full h-2 bg-green-200 dark:bg-green-800/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 dark:bg-green-400 rounded-full"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default CompletedProjectCard
