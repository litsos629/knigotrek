import { useState, useEffect } from 'react'
import { initSupabase, restoreSession } from './services/cloudSyncService'
import Sidebar from './components/Sidebar'
import HomePage from './components/HomePage'
import ProjectsPage from './components/ProjectsPage'
import NotesPage from './components/NotesPage'
import SettingsPage from './components/SettingsPage'
import FocusPage from './components/FocusPage'
import WelcomeModal from './components/WelcomeModal'
import SyncPage from './components/SyncPage'
import ReportGenerator from './components/ReportGenerator'
import WeeklyDigestModal, { shouldShowWeeklyDigest } from './components/WeeklyDigestModal'
import InstallPrompt from './components/InstallPrompt'
import i18n, { getLanguage, persistLanguageForMainProcess } from './i18n'
import { getSetting } from './services/databaseService'

// Функция для проверки и отправки напоминания
// Настройки читаем через getSetting — в Electron они лежат в SQLite, не в localStorage
const checkAndSendReminder = async () => {
  const enabled = await getSetting('notificationsEnabled')
  if (enabled !== 'true') return
  const notificationTime = (await getSetting('notificationTime')) || '19:00'

  const now = new Date()
  const [hours, minutes] = notificationTime.split(':')
  const reminderTime = new Date()
  reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
  
  // Проверяем, что сейчас время напоминания (с точностью до минуты)
  const diff = Math.abs(now.getTime() - reminderTime.getTime())
  if (diff < 60000) {
    // Проверяем, отправляли ли уже сегодня
    const lastSent = localStorage.getItem('knigotrek-last-reminder')
    const today = now.toDateString()
    
    if (lastSent !== today) {
      if (Notification.permission === 'granted') {
        new Notification(i18n.t('notifications.reminderTitle'), {
          body: i18n.t('notifications.reminderBody'),
          icon: 'icons/192.png',
          tag: 'knigotrek-reminder'
        })
        localStorage.setItem('knigotrek-last-reminder', today)
      }
    }
  }
}

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [showWelcome, setShowWelcome] = useState(false)
  const [showWeeklyDigest, setShowWeeklyDigest] = useState(false)

  // State для таймера (чтобы не сбрасывался при переключении страниц)
  const [timerDuration, setTimerDuration] = useState(25)
  const [timerTimeLeft, setTimerTimeLeft] = useState(25 * 60)
  const [timerIsRunning, setTimerIsRunning] = useState(false)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)
  const [timerIsFinished, setTimerIsFinished] = useState(false)
  
  // Загружаем тему
  useEffect(() => {
    const saved = localStorage.getItem('knigotrek-settings')
    interface Settings {
      theme?: 'light' | 'dark'
      onboardingCompleted?: boolean
    }
    let settings: Settings = {}
    if (saved) {
      settings = JSON.parse(saved)
      if (settings.theme) {
        setTheme(settings.theme)
        if (settings.theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }
    
    // Проверяем онбординг
    if (!localStorage.getItem('knigotrek_welcomed')) {
      setShowWelcome(true)
    }

    // Инициализируем Supabase и восстанавливаем сессию
    initSupabase()
    restoreSession().catch(() => {}) // Non-blocking

    // Язык — в settings-таблицу, чтобы main-процесс Electron знал его для меню/уведомлений
    persistLanguageForMainProcess(getLanguage())

    // Проверяем еженедельный дайджест (после онбординга)
    if (settings?.onboardingCompleted && shouldShowWeeklyDigest()) {
      setShowWeeklyDigest(true)
    }
  }, [])

  // Функция переключения темы
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // Сохраняем в localStorage
    const saved = localStorage.getItem('knigotrek-settings')
    const settings = saved ? JSON.parse(saved) : {}
    settings.theme = newTheme
    localStorage.setItem('knigotrek-settings', JSON.stringify(settings))
  }

  // Проверяем напоминания каждую минуту
  useEffect(() => {
    const interval = setInterval(() => {
      checkAndSendReminder()
    }, 60000) // Каждую минуту

    return () => clearInterval(interval)
  }, [])

  // Пункты меню Electron: Файл → Экспорт/Импорт данных, Помощь → О программе
  useEffect(() => {
    window.electronAPI?.onMenuAction?.((action) => {
      if (action === 'menu-export-data') {
        import('./services/dataTransferService')
          .then(async m => m.downloadAsFile(await m.buildExportData()))
          .catch(err => console.error('Menu export error:', err))
      } else if (action === 'menu-import-data') {
        setCurrentPage('sync')
      } else if (action === 'menu-about') {
        setCurrentPage('settings')
      }
    })
  }, [])

  // Таймер работает в фоне (даже когда FocusPage не отображается)
  useEffect(() => {
    if (!timerIsRunning) return
    
    const interval = setInterval(() => {
      setTimerTimeLeft((prev) => {
        if (prev <= 1) {
          setTimerIsRunning(false)
          setTimerIsFinished(true)
          // Звук окончания
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            oscillator.frequency.value = 800
            oscillator.type = 'sine'
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
            
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 0.5)
          } catch (e) {
            // sound not supported
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => {
      clearInterval(interval)
    }
  }, [timerIsRunning])

  // Функция для рендера нужной страницы
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />
      case 'projects':
        return <ProjectsPage />
      case 'notes':
        return <NotesPage />
      case 'focus':
        return <FocusPage 
          selectedProjectId={selectedProjectId} 
          setSelectedProjectId={setSelectedProjectId}
          timerDuration={timerDuration}
          setTimerDuration={setTimerDuration}
          timerTimeLeft={timerTimeLeft}
          setTimerTimeLeft={setTimerTimeLeft}
          timerIsRunning={timerIsRunning}
          setTimerIsRunning={setTimerIsRunning}
          timerStartTime={timerStartTime}
          setTimerStartTime={setTimerStartTime}
          timerIsFinished={timerIsFinished}
          setTimerIsFinished={setTimerIsFinished}
        />
      case 'settings':
        return <SettingsPage theme={theme} toggleTheme={toggleTheme} />
      case 'sync':
        return <SyncPage />
      case 'reports':
        return <ReportGenerator />
      default:
        return <HomePage selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />
    }
  }

  const handleWelcomeClose = () => {
    setShowWelcome(false)
    localStorage.setItem('knigotrek_welcomed', '1')
    const saved = localStorage.getItem('knigotrek-settings')
    const settings = saved ? JSON.parse(saved) : {}
    settings.onboardingCompleted = true
    localStorage.setItem('knigotrek-settings', JSON.stringify(settings))
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar слева */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
      
      {/* Основная область справа */}
      <div className="flex-1 p-8">
        {renderPage()}
      </div>
      
      {/* Онбординг */}
      {showWelcome && <WelcomeModal onClose={handleWelcomeClose} />}
      
      {/* Еженедельный дайджест */}
      {showWeeklyDigest && (
        <WeeklyDigestModal onClose={() => setShowWeeklyDigest(false)} />
      )}

      {/* PWA установка */}
      <InstallPrompt />
    </div>
  )
}

export default App