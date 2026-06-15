import { useState, useEffect } from 'react'
import { intlLocale } from '../i18n/dateLocale'
import { useTranslation } from 'react-i18next'
import type { MilestoneData } from '../services/pdfService'
import { todayLocal } from '../utils/dates'

interface MilestoneModalProps {
  isOpen: boolean
  onClose: () => void
  milestoneData: MilestoneData | null
}

function MilestoneModal({ isOpen, onClose, milestoneData }: MilestoneModalProps) {
  const { t } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Модалка остаётся смонтированной — сбрасываем ошибку при каждом открытии
  useEffect(() => {
    if (isOpen) setError(null)
  }, [isOpen])

  if (!isOpen || !milestoneData) return null

  const handleDownloadReport = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      const doc = await (await import('../services/pdfService')).generateMilestoneReport(milestoneData)
      const fileName = `milestone-50-${milestoneData.project.id}-${todayLocal()}.pdf`
      doc.save(fileName)
    } catch (err) {
      setError(t('projects:milestoneModal.reportError'))
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
            <h2 className="text-2xl font-bold">🎉 {t('projects:milestoneModal.congrats')}</h2>
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
              {t('projects:milestoneModal.halfwayDone')}
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {t('projects:milestoneModal.youWrote', {
                total: milestoneData.stats.totalSymbols.toLocaleString(intlLocale()),
                target: milestoneData.project.targetSymbols.toLocaleString(intlLocale())
              })}
            </p>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-6">
            <p className="text-gray-700 dark:text-gray-300">
              {t('projects:milestoneModal.reportReady')}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleDownloadReport}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? t('projects:milestoneModal.generating') : <>📄 {t('projects:milestoneModal.downloadPdf')}</>}
            </button>
          </div>
        </div>

        {/* Футер */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg font-medium transition"
          >
            {t('projects:milestoneModal.later')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MilestoneModal
