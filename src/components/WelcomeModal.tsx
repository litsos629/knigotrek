import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface WelcomeModalProps {
  onClose: () => void
}

function WelcomeModal({ onClose }: WelcomeModalProps) {
  const { t } = useTranslation()
  useEffect(() => {
    // Блокируем скролл при открытии модалки
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-2xl w-full mx-4 animate-slideUp">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2 text-center">
          {t('modals:welcome.title')} 📚
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
          {t('modals:welcome.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-6 text-center">
            <div className="text-4xl mb-3">✍️</div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">
              {t('modals:welcome.trackTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('modals:welcome.trackDesc')}
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">
              {t('modals:welcome.projectsTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('modals:welcome.projectsDesc')}
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-6 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">
              {t('modals:welcome.focusTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('modals:welcome.focusDesc')}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-lg"
        >
          {t('modals:welcome.start')} 🚀
        </button>
      </div>
    </div>
  )
}

export default WelcomeModal


