import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function InstallPrompt() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Проверяем, не был ли промпт уже отклонён
    const wasDismissed = localStorage.getItem('knigotrek-install-dismissed')
    if (wasDismissed) {
      setDismissed(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('knigotrek-install-dismissed', 'true')
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{'\uD83D\uDCF2'}</div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 dark:text-white text-sm">
            {t('modals:install.title')}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {t('modals:install.subtitle')}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {'\u2715'}
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="w-full mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
      >
        {t('modals:install.action')}
      </button>
    </div>
  )
}

export default InstallPrompt
