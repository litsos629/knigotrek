import { useState, useEffect } from 'react'
import { intlLocale } from '../i18n/dateLocale'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { buildExportData, downloadAsFile, isValidImportData, importData } from '../services/dataTransferService'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import {
  isConfigured,
  getCurrentUser, signInWithSyncKey, signInWithEmail, signUp, signOut,
  generateSyncKey, getSavedSyncKey, getSyncMethod, syncAll, getLastSyncTime
} from '../services/cloudSyncService'

function SyncPage() {
  const { t } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const [cloudUser, setCloudUser] = useState<any>(null)
  const [syncMethod, setSyncMethod] = useState<'key' | 'email'>('key')
  const [syncKeyInput, setSyncKeyInput] = useState(getSavedSyncKey() ?? '')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ pushed: number; pulled: number; errors: string[] } | null>(null)
  const [cloudError, setCloudError] = useState('')
  const [showSyncKey, setShowSyncKey] = useState(false)
  const configured = isConfigured()

  useEffect(() => {
    getCurrentUser().then(u => setCloudUser(u))
  }, [])

  const exportToFile = async () => {
    setIsGenerating(true)
    try {
      const data = await buildExportData()
      downloadAsFile(data, 'knigotrek-sync')
    } catch (error) {
      console.error('Export error:', error)
      showToast(t('sync:exportError'), 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportStatus('idle')
    setImportMessage('')

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!isValidImportData(data)) {
        throw new Error(t('sync:invalidFormat'))
      }

      // Подтверждение
      const confirmed = await confirm({
        title: t('sync:importConfirmTitle'),
        message: t('sync:importConfirmMessage', {
          entries: data.entries?.length || 0,
          projects: data.projects?.length || 0,
          sessions: data.sessions?.length || 0,
          notes: data.notes?.length || 0,
          chapters: data.chapters?.length || 0
        }),
        confirmText: t('sync:importConfirmAction'),
        variant: 'warning'
      })
      if (!confirmed) {
        return
      }

      await importData(data)

      setImportStatus('success')
      setImportMessage(t('sync:importSuccess'))

      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error('Import error:', error)
      setImportStatus('error')
      setImportMessage(error instanceof Error ? error.message : t('sync:importError'))
    }

    // Сброс input
    event.target.value = ''
  }

  const handleConnectWithKey = async () => {
    setCloudError('')
    try {
      await signInWithSyncKey(syncKeyInput.trim())
      const u = await getCurrentUser()
      setCloudUser(u)
    } catch (e) {
      setCloudError((e as Error).message)
    }
  }

  const handleSignIn = async () => {
    setCloudError('')
    try {
      await signInWithEmail(emailInput, passwordInput)
      const u = await getCurrentUser()
      setCloudUser(u)
    } catch (e) {
      setCloudError((e as Error).message)
    }
  }

  const handleSignUp = async () => {
    setCloudError('')
    try {
      await signUp(emailInput, passwordInput)
      const u = await getCurrentUser()
      setCloudUser(u)
    } catch (e) {
      setCloudError((e as Error).message)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setCloudUser(null)
    setSyncResult(null)
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    setCloudError('')
    try {
      const result = await syncAll()
      setSyncResult(result)
    } catch (e) {
      setCloudError((e as Error).message)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          🔄 {t('sync:title')}
          <HelpTip text={t('common:help.sync')} />
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('sync:subtitle')}
        </p>
      </div>

      {/* Экспорт данных */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          📤 {t('sync:exportTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('sync:exportDescription')}
        </p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={exportToFile}
            disabled={isGenerating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
          >
            📥 {isGenerating ? t('sync:generating') : t('sync:exportFile')}
          </button>
        </div>
      </div>

      {/* Импорт данных */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          📥 {t('sync:importTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('sync:importDescription')}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('sync:importFromFile')}
            </label>
            {/* Нативный input скрыт: его надписи рисует браузер по локали ОС, а не приложения */}
            <input
              id="sync-import-file"
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById('sync-import-file')?.click()}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 rounded-lg text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-800 transition"
            >
              {t('sync:chooseFile')}
            </button>
          </div>

          {importStatus === 'success' && (
            <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
              <p className="text-green-800 dark:text-green-200">{importMessage}</p>
            </div>
          )}

          {importStatus === 'error' && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{importMessage}</p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">
              💡 {t('sync:howToTitle')}
            </h3>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>{t('sync:howToStep1')}</li>
              <li>{t('sync:howToStep2')}</li>
              <li>{t('sync:howToStep3')}</li>
              <li>{t('sync:howToStep4')}</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Облачная синхронизация */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">☁️</span>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('sync:cloudTitle')}</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              {t('sync:betaBadge')}
            </span>
          </div>

          {!configured ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">{t('sync:supabaseNotConfigured')}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                {t('sync:supabaseHint')}
              </p>
            </div>
          ) : cloudUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span>✅</span>
                <span className="text-sm font-medium">
                  {t('sync:connected', { method: getSyncMethod() === 'key' ? t('sync:methodKey') : t('sync:methodEmail') })}
                </span>
              </div>

              {getSyncMethod() === 'key' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {showSyncKey ? (getSavedSyncKey() ?? '—') : '••••••••••••••••••••••••'}
                  </span>
                  <button onClick={() => setShowSyncKey(v => !v)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    {showSyncKey ? t('sync:hide') : t('sync:show')}
                  </button>
                  {getSavedSyncKey() && (
                    <button
                      onClick={() => navigator.clipboard.writeText(getSavedSyncKey()!)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {t('sync:copy')}
                    </button>
                  )}
                </div>
              )}

              {getLastSyncTime() && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('sync:lastSync', { time: new Date(getLastSyncTime()!).toLocaleString(intlLocale()) })}
                </p>
              )}

              {syncResult && (
                <div className={`p-3 rounded-lg text-sm ${syncResult.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  {syncResult.errors.length === 0 ? (
                    <p className="text-green-700 dark:text-green-300">
                      {t('sync:syncStats', { pushed: syncResult.pushed, pulled: syncResult.pulled })}
                    </p>
                  ) : (
                    <div>
                      <p className="text-red-700 dark:text-red-300">{t('sync:syncErrors', { errors: syncResult.errors.join(', ') })}</p>
                    </div>
                  )}
                </div>
              )}

              {cloudError && (
                <p className="text-sm text-red-600 dark:text-red-400">{cloudError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition"
                >
                  {isSyncing ? `⏳ ${t('sync:syncingNow')}` : `🔄 ${t('sync:syncNow')}`}
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  {t('sync:signOut')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setSyncMethod('key')}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${syncMethod === 'key' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                  {t('sync:tabKey')}
                </button>
                <button
                  onClick={() => setSyncMethod('email')}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${syncMethod === 'email' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                  {t('sync:tabEmail')}
                </button>
              </div>

              {syncMethod === 'key' ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('sync:keyDescription')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={syncKeyInput}
                      onChange={e => setSyncKeyInput(e.target.value)}
                      placeholder={t('sync:keyPlaceholder')}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConnectWithKey}
                      disabled={!syncKeyInput.trim()}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition"
                    >
                      {t('sync:connect')}
                    </button>
                    <button
                      onClick={() => setSyncKeyInput(generateSyncKey())}
                      className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      {t('sync:createNew')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder={t('sync:emailPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder={t('sync:passwordPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSignIn}
                      disabled={!emailInput || !passwordInput}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition"
                    >
                      {t('sync:signIn')}
                    </button>
                    <button
                      onClick={handleSignUp}
                      disabled={!emailInput || !passwordInput}
                      className="flex-1 px-4 py-2 border border-indigo-600 text-indigo-600 dark:text-indigo-400 text-sm rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 font-medium transition"
                    >
                      {t('sync:signUp')}
                    </button>
                  </div>
                </div>
              )}

              {cloudError && (
                <p className="text-sm text-red-600 dark:text-red-400">{cloudError}</p>
              )}
            </div>
          )}
        </div>
    </div>
  )
}

export default SyncPage
