import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting, setSetting, getProjects, saveProject, createBackup, type Project } from '../services/databaseService'
import { buildExportData, downloadAsFile, isValidImportData, importData } from '../services/dataTransferService'
import { getGenreLabel } from '../config/appConfig'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import { setLanguage } from '../i18n'

interface SettingsPageProps {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

function SettingsPage({ theme, toggleTheme }: SettingsPageProps) {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language === 'en' ? 'en' : 'ru'
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationTime, setNotificationTime] = useState('19:00')
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [trayOnClose, setTrayOnClose] = useState(false)
  const [hiddenProjects, setHiddenProjects] = useState<Project[]>([])
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  // Загружаем настройки из БД
  useEffect(() => {
    loadSettings()
    loadHiddenProjects()

    // Проверяем разрешение на уведомления
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  const loadSettings = async () => {
    try {
      const notificationsEnabledStr = await getSetting('notificationsEnabled')
      const notificationTimeStr = await getSetting('notificationTime')
      
      if (notificationsEnabledStr !== null) {
        setNotificationsEnabled(notificationsEnabledStr === 'true')
      }
      if (notificationTimeStr !== null) {
        setNotificationTime(notificationTimeStr)
      }
      const trayStr = await getSetting('trayOnClose')
      if (trayStr !== null) {
        setTrayOnClose(trayStr === 'true')
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      // Fallback на localStorage для совместимости
      const saved = localStorage.getItem('knigotrek-settings')
      if (saved) {
        const settings = JSON.parse(saved)
        setNotificationsEnabled(settings.notificationsEnabled || false)
        setNotificationTime(settings.notificationTime || '19:00')
      }
    }
  }

  // Сохраняем настройки
  const saveSettings = async () => {
    try {
      await setSetting('notificationsEnabled', notificationsEnabled.toString())
      await setSetting('notificationTime', notificationTime)
    } catch (error) {
      console.error('Error saving settings:', error)
      // Fallback на localStorage
      const settings = {
        notificationsEnabled,
        notificationTime
      }
      localStorage.setItem('knigotrek-settings', JSON.stringify(settings))
    }
  }

  useEffect(() => {
    saveSettings()
  }, [notificationsEnabled, notificationTime])

  // Запрос разрешения на уведомления
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      
      if (permission === 'granted') {
        setNotificationsEnabled(true)
        // Показываем тестовое уведомление
        new Notification(t('settings:notifications.enabledTitle'), {
          body: t('settings:notifications.enabledBody'),
          icon: 'icons/192.png'
        })
      }
    }
  }

  // Тест уведомления
  const sendTestNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification(t('settings:notifications.testTitle'), {
        body: t('settings:notifications.testBody'),
        icon: 'icons/192.png',
        tag: 'knigotrek-reminder'
      })
    }
  }

  // Сворачивание в трей: настройка хранится в settings и живо сообщается main-процессу
  const handleTrayToggle = async (enabled: boolean) => {
    setTrayOnClose(enabled)
    await setSetting('trayOnClose', enabled.toString())
    window.electronAPI?.setTrayOnClose?.(enabled)
  }

  const loadHiddenProjects = async () => {
    const projects = await getProjects()
    setHiddenProjects(projects.filter(p => p.isHidden))
  }

  const handleUnhideProject = async (projectId: string) => {
    const project = hiddenProjects.find(p => p.id === projectId)
    if (!project) return

    const updatedProject: Project = {
      ...project,
      isHidden: false
    }
    await saveProject(updatedProject)
    await loadHiddenProjects()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">
          ⚙️ {t('settings:title')}
        </h1>

        {/* Язык */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            🌐 {t('settings:language.title')}
          </h2>
          <div className="flex gap-2">
            {(['ru', 'en'] as const).map((lng) => (
              <button
                key={lng}
                onClick={() => setLanguage(lng)}
                className={`px-4 py-2 rounded-lg transition ${
                  currentLang === lng
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t(`settings:language.${lng}`)}
              </button>
            ))}
          </div>
          {window.electronAPI && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('settings:language.restartHint')}
            </p>
          )}
        </div>

        {/* Тема */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            🎨 {t('settings:theme.title')}
          </h2>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            <span className="text-2xl">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span>{theme === 'light' ? t('settings:theme.dark') : t('settings:theme.light')}</span>
          </button>
        </div>

        {/* О программе */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            {t('settings:about.title')}
          </h2>
          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('settings:about.description')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('settings:about.supportPrefix')}{' '}
              <a
                href="https://github.com/litsos629/knigotrek"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('settings:about.starLink')}
              </a>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('settings:about.sourcePrefix')}{' '}
              <a
                href="https://github.com/litsos629/knigotrek"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                github.com/litsos629/knigotrek
              </a>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
              ⚠️ {t('settings:about.safety')}
            </p>
          </div>
        </div>

        {/* Уведомления */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              🔔 {t('settings:notifications.title')}
            </h2>
            
            {/* Статус разрешения */}
            {notificationPermission === 'default' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-800 mb-3">
                  {t('settings:notifications.requestPrompt')}
                </p>
                <button
                  onClick={requestNotificationPermission}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {t('settings:notifications.requestButton')}
                </button>
              </div>
            )}

            {notificationPermission === 'denied' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 mb-2">
                  {t('settings:notifications.blockedTitle')}
                </p>
                <p className="text-sm text-red-600">
                  {t('settings:notifications.blockedHint')}
                </p>
              </div>
            )}

            {notificationPermission === 'granted' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 flex items-center gap-2">
                  ✅ {t('settings:notifications.granted')}
                </p>
              </div>
            )}

            {/* Включить/выключить */}
            {notificationPermission === 'granted' && (
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">
                    {t('settings:notifications.enableDaily')}
                  </span>
                </label>

                {/* Время напоминания */}
                {notificationsEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('settings:notifications.timeLabel')}
                    </label>
                    <input
                      type="time"
                      value={notificationTime}
                      onChange={(e) => setNotificationTime(e.target.value)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {t('settings:notifications.timeHint')}
                    </p>
                  </div>
                )}

                {/* Тестовое уведомление */}
                <button
                  onClick={sendTestNotification}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
                >
                  {t('settings:notifications.testButton')}
                </button>
              </div>
            )}
          </div>

          {/* Информация */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">💡 {t('settings:notifications.howItWorksTitle')}</h3>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• {t('settings:notifications.howItWorks1')}</li>
              <li>• {t('settings:notifications.howItWorks2')}</li>
              <li>• {t('settings:notifications.howItWorks3')}</li>
            </ul>
          </div>
        </div>

        {/* Поведение окна (только десктоп) */}
        {window.electronAPI && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              🪟 {t('settings:tray.title')}
            </h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={trayOnClose}
                onChange={(e) => handleTrayToggle(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {t('settings:tray.trayLabel')}
              </span>
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {t('settings:tray.trayHint')}
            </p>
          </div>
        )}

        {/* Автоматические бэкапы */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            💾 {t('settings:backups.title')}
          </h2>
          
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {window.electronAPI ? (
                  <>
                    ✅ {t('settings:backups.enabled')}<br/>
                    {t('settings:backups.enabledHint')}
                  </>
                ) : (
                  <>
                    ⚠️ {t('settings:backups.browserOnly')}<br/>
                    {t('settings:backups.browserOnlyHint')}
                  </>
                )}
              </p>
            </div>

            {window.electronAPI && (
              <div>
                <button
                  onClick={async () => {
                    try {
                      const result = await createBackup()
                      if (result.success) {
                        showToast(t('settings:backups.createSuccess'), 'success')
                      } else {
                        showToast(t('settings:backups.createError', { error: result.error || t('settings:backups.unknownError') }), 'error')
                      }
                    } catch (error) {
                      console.error('Backup error:', error)
                      showToast(t('settings:backups.createFailed'), 'error')
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  🔄 {t('settings:backups.createNow')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Скрытые проекты */}
        {hiddenProjects.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              {'\uD83D\uDC41\uFE0F'} {t('settings:hiddenProjects.title', { count: hiddenProjects.length })}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('settings:hiddenProjects.description')}
            </p>
            <div className="space-y-2">
              {hiddenProjects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-800 dark:text-white">{project.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                      {getGenreLabel(project.genre)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnhideProject(project.id)}
                    className="px-3 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/40 transition"
                  >
                    {t('settings:hiddenProjects.show')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Экспорт/Импорт данных */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            📤 {t('settings:data.title')}
          </h2>
          
          <div className="space-y-4">
            {/* Экспорт */}
            <div>
              <button
                onClick={async () => {
                  try {
                    downloadAsFile(await buildExportData())
                  } catch (error) {
                    console.error('Export error:', error)
                    showToast(t('settings:data.exportError'), 'error')
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                📥 {t('settings:data.export')}
              </button>
            </div>
            
            {/* Импорт */}
            <div>
              <input
                type="file"
                accept=".json"
                id="import-file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  
                  const reader = new FileReader()
                  reader.onload = async (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string)
                      if (!isValidImportData(data)) {
                        showToast(t('settings:data.importError'), 'error')
                        return
                      }

                      const confirmed = await confirm({
                        title: t('settings:data.importConfirmTitle'),
                        message: t('sync:importConfirmMessage', {
                          entries: data.entries?.length || 0,
                          projects: data.projects?.length || 0,
                          sessions: data.sessions?.length || 0,
                          notes: data.notes?.length || 0,
                          chapters: data.chapters?.length || 0
                        }),
                        confirmText: t('settings:data.importConfirmButton'),
                        variant: 'danger'
                      })
                      if (!confirmed) return

                      await importData(data)

                      showToast(t('settings:data.importSuccess'), 'success')
                      setTimeout(() => window.location.reload(), 1500)
                    } catch (error) {
                      console.error('Import error:', error)
                      showToast(t('settings:data.importError'), 'error')
                    }
                  }
                  reader.readAsText(file)
                  // Сброс input
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => document.getElementById('import-file')?.click()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                📤 {t('settings:data.import')}
              </button>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                💡 {t('settings:data.hint')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage