import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CHANGELOG } from '../data/changelog'

interface WhatsNewModalProps {
  onClose: () => void
}

function WhatsNewModal({ onClose }: WhatsNewModalProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'ru'
  const latest = CHANGELOG[0]

  useEffect(() => {
    // Блокируем скролл при открытии модалки
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-lg w-full mx-4 animate-slideUp">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1 text-center">
          ✨ {t('modals:whatsNew.title', { version: latest.version })}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          {t('modals:whatsNew.subtitle')}
        </p>

        <ul className="space-y-3 mb-8">
          {latest[lang].map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-indigo-500 dark:text-indigo-400 flex-shrink-0">●</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          {t('modals:whatsNew.gotIt')}
        </button>
      </div>
    </div>
  )
}

export default WhatsNewModal
