import { useState, useEffect } from 'react'
import { intlLocale } from '../i18n/dateLocale'
import { useTranslation } from 'react-i18next'
import type { MilestoneData } from '../services/pdfService'
import type { Project } from '../services/databaseService'
import { todayLocal } from '../utils/dates'

interface ProjectCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project | null
  milestoneData: MilestoneData | null
  onCreateNewProject?: () => void
}

function ProjectCompletionModal({ 
  isOpen, 
  onClose, 
  project, 
  milestoneData,
  onCreateNewProject
}: ProjectCompletionModalProps) {
  const { t } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Модалка остаётся смонтированной — сбрасываем ошибку при каждом открытии
  useEffect(() => {
    if (isOpen) setError(null)
  }, [isOpen])

  if (!isOpen || !project || !milestoneData) return null

  const handleDownloadReport = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      const doc = await (await import('../services/pdfService')).generateFinalReport(milestoneData)
      const fileName = `final-report-${project.id}-${todayLocal()}.pdf`
      doc.save(fileName)
      
    } catch (err) {
      setError(t('projects:completionModal.reportError'))
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
        {/* Заголовок */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">🎉 {t('projects:completionModal.congrats')}</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Содержимое */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              {t('projects:completionModal.projectCompleted')}
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
              "{project.title}"
            </p>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div>{t('projects:completionModal.symbolsWritten', { count: milestoneData.stats.totalSymbols.toLocaleString(intlLocale()) })}</div>
              <div>{t('projects:completionModal.daysWorked', { count: milestoneData.stats.daysWorked })}</div>
              {milestoneData.stats.streak && (
                <div>{t('projects:completionModal.streak', { count: milestoneData.stats.streak })}</div>
              )}
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6 border border-green-200 dark:border-green-800">
            <p className="text-gray-700 dark:text-gray-300 text-center">
              {t('projects:completionModal.movedToArchive')}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-center text-sm mt-1">
              {t('projects:completionModal.canStartNew')}
            </p>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleDownloadReport}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? t('projects:completionModal.generating') : <>📄 {t('projects:completionModal.createReport')}</>}
            </button>

            {onCreateNewProject && (
              <button
                onClick={() => {
                  onCreateNewProject()
                  onClose()
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all"
              >
                {t('projects:completionModal.createNewProject')}
              </button>
            )}
          </div>
        </div>

        {/* Футер */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg font-medium transition"
          >
            {t('actions.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProjectCompletionModal
