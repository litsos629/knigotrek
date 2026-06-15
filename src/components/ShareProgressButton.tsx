import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ShareProgressModal from './ShareProgressModal'

interface ShareProgressButtonProps {
  entries: Array<{ date: string; symbols: number }>
  sessions?: Array<{ date: string; duration: number; symbols: number; speed: number }>
  streak: number
  totalSymbols: number
  projectTitle?: string
}

function ShareProgressButton({ entries, sessions, streak, totalSymbols, projectTitle }: ShareProgressButtonProps) {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<'week' | 'session' | 'streak' | 'completion'>('week')

  const handleShare = (template: 'week' | 'session' | 'streak' | 'completion') => {
    setSelectedTemplate(template)
    setShowModal(true)
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            📱 {t('reports:share.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            {t('reports:share.subtitle')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleShare('week')}
              className="p-4 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800 transition text-left"
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">{t('reports:share.week')}</div>
            </button>

            {sessions && sessions.length > 0 && (
              <button
                onClick={() => handleShare('session')}
                className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800 transition text-left"
              >
                <div className="text-2xl mb-2">⏱️</div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">{t('reports:share.session')}</div>
              </button>
            )}

            {streak > 0 && (
              <button
                onClick={() => handleShare('streak')}
                className="p-4 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800 transition text-left"
              >
                <div className="text-2xl mb-2">🔥</div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">{t('reports:share.streak', { count: streak })}</div>
              </button>
            )}

            {projectTitle && (
              <button
                onClick={() => handleShare('completion')}
                className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 transition text-left"
              >
                <div className="text-2xl mb-2">🏆</div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">{t('reports:share.completion')}</div>
              </button>
            )}
          </div>
        </div>

      <ShareProgressModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        template={selectedTemplate}
        data={{
          entries,
          sessions,
          streak,
          totalSymbols,
          projectTitle
        }}
      />
    </>
  )
}

export default ShareProgressButton
