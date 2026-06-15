import { app, BrowserWindow, ipcMain, Menu, Notification, shell, Tray } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import Database from 'better-sqlite3'
import { initDatabase, queryDatabase, backupDatabase } from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Локаль Chromium = язык приложения: иначе нативные контролы (формат полей даты,
// надписи file-диалогов) рисуются на языке ОС. Переключатель --lang должен быть
// выставлен ДО ready, поэтому язык читаем из БД синхронно при старте.
try {
  const dbPath = path.join(app.getPath('userData'), 'knigotrek.db')
  if (fs.existsSync(dbPath)) {
    const earlyDb = new Database(dbPath, { readonly: true })
    const row = earlyDb.prepare("SELECT value FROM settings WHERE key = 'language'").get()
    earlyDb.close()
    if (row && row.value === 'en') {
      app.commandLine.appendSwitch('lang', 'en-US')
    } else if (row && row.value === 'ru') {
      app.commandLine.appendSwitch('lang', 'ru')
    }
  }
} catch {
  /* нет БД или настройки — останется язык системы; применится после первого перезапуска */
}

let mainWindow
let isQuitting = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: path.join(__dirname, '../dist/icons/512.png'),
    show: false // Не показывать пока не загрузится
  })

  // Внешние ссылки (target="_blank") открываем в браузере по умолчанию, не в окне Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Загружаем React приложение
  // В режиме разработки всегда используем dev сервер
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  if (isDev) {
    // Ждем немного, чтобы Vite сервер точно запустился
    const loadDevServer = () => {
      const tryPort = (port) => {
        const url = `http://localhost:${port}`
        console.log('Trying to load from:', url)
        return mainWindow.loadURL(url).catch(err => {
          console.error(`Failed to load from port ${port}:`, err.message)
          return Promise.reject(err)
        })
      }
      
      // Пробуем сначала 5173, потом 5174
      tryPort(5173).catch(() => {
        console.log('Port 5173 failed, trying 5174...')
        tryPort(5174).catch(() => {
          console.error('Both dev server ports failed, using production build')
          mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
        })
      })
    }
    
    // Даем время серверу запуститься
    setTimeout(loadDevServer, 2000)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Показываем окно когда готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Сворачивание в трей вместо закрытия — по настройке trayOnClose
  // (preventDefault должен быть синхронным, поэтому настройка кэшируется в trayOnClose)
  mainWindow.on('close', (event) => {
    if (!isQuitting && trayOnClose) {
      event.preventDefault()
      mainWindow.hide()
      ensureTray()
    }
  })

  // Создаём меню
  createMenu()
}

// Локализация меню: язык приложения приходит из renderer (settings.language)
let currentLang = 'ru'

const MENU_LABELS = {
  ru: {
    file: 'Файл', exportData: 'Экспорт данных', importData: 'Импорт данных', quit: 'Выход',
    edit: 'Правка', undo: 'Отменить', redo: 'Повторить', cut: 'Вырезать', copy: 'Копировать', paste: 'Вставить',
    view: 'Вид', reload: 'Перезагрузить', forceReload: 'Принудительная перезагрузка',
    devTools: 'Инструменты разработчика', resetZoom: 'Сбросить масштаб', zoomIn: 'Увеличить',
    zoomOut: 'Уменьшить', fullscreen: 'Полноэкранный режим',
    help: 'Помощь', about: 'О программе'
  },
  en: {
    file: 'File', exportData: 'Export data', importData: 'Import data', quit: 'Quit',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste',
    view: 'View', reload: 'Reload', forceReload: 'Force reload',
    devTools: 'Developer tools', resetZoom: 'Reset zoom', zoomIn: 'Zoom in',
    zoomOut: 'Zoom out', fullscreen: 'Toggle fullscreen',
    help: 'Help', about: 'About'
  }
}

function createMenu() {
  const l = MENU_LABELS[currentLang] || MENU_LABELS.ru
  const template = [
    {
      label: l.file,
      submenu: [
        {
          label: l.exportData,
          click: () => {
            mainWindow.webContents.send('menu-export-data')
          }
        },
        {
          label: l.importData,
          click: () => {
            mainWindow.webContents.send('menu-import-data')
          }
        },
        { type: 'separator' },
        {
          label: l.quit,
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true
            app.quit()
          }
        }
      ]
    },
    {
      label: l.edit,
      submenu: [
        { role: 'undo', label: l.undo },
        { role: 'redo', label: l.redo },
        { type: 'separator' },
        { role: 'cut', label: l.cut },
        { role: 'copy', label: l.copy },
        { role: 'paste', label: l.paste }
      ]
    },
    {
      label: l.view,
      submenu: [
        { role: 'reload', label: l.reload },
        { role: 'forceReload', label: l.forceReload },
        { role: 'toggleDevTools', label: l.devTools },
        { type: 'separator' },
        { role: 'resetZoom', label: l.resetZoom },
        { role: 'zoomIn', label: l.zoomIn },
        { role: 'zoomOut', label: l.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: l.fullscreen }
      ]
    },
    {
      label: l.help,
      submenu: [
        {
          label: l.about,
          click: () => {
            mainWindow.webContents.send('menu-about')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Renderer сообщает язык при старте и при переключении в Настройках
ipcMain.on('app-language-changed', (event, lng) => {
  const next = lng === 'en' ? 'en' : 'ru'
  if (next !== currentLang) {
    currentLang = next
    createMenu()
    updateTrayMenu()
  }
})

// ========== Трей ==========

let tray = null
let trayOnClose = false

const TRAY_LABELS = {
  ru: { show: 'Открыть Книготрек', quit: 'Выход' },
  en: { show: 'Open Knigotrek', quit: 'Quit' }
}

function ensureTray() {
  if (tray) return
  try {
    // Иконка из dist: каталог build/ не попадает в упакованное приложение
    tray = new Tray(path.join(__dirname, '../dist/icons/32.png'))
    tray.setToolTip('Книготрек')
    updateTrayMenu()
    tray.on('click', () => {
      if (mainWindow) mainWindow.show()
    })
  } catch (error) {
    console.error('Tray creation error:', error)
  }
}

function updateTrayMenu() {
  if (!tray) return
  const l = TRAY_LABELS[currentLang] || TRAY_LABELS.ru
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: l.show, click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: l.quit, click: () => { isQuitting = true; app.quit() } }
  ]))
}

// Настройка «сворачивать в трей» меняется в Настройках без перезапуска
ipcMain.on('tray-on-close-changed', (event, enabled) => {
  trayOnClose = enabled === true || enabled === 'true'
  if (trayOnClose) ensureTray()
})

// Вечернее напоминание о дневной цели (20:00)
function scheduleEveningReminder() {
  const scheduleNext = () => {
    const now = new Date()
    const target = new Date()
    target.setHours(20, 0, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    const ms = target.getTime() - now.getTime()
    setTimeout(async () => {
      await checkAndNotifyProgress()
      // Повтор каждые 24 часа
      setInterval(checkAndNotifyProgress, 24 * 60 * 60 * 1000)
    }, ms)
  }
  scheduleNext()
}

// Тексты системных уведомлений (язык приложения хранится в settings.language)
const NOTIFICATION_TEXTS = {
  ru: {
    title: 'Книготрек — не забудь написать сегодня!',
    body: (title, needed, written) => `«${title}»: нужно ${needed.toLocaleString('ru-RU')} символов, написано ${written.toLocaleString('ru-RU')}`
  },
  en: {
    title: "Knigotrek — don't forget to write today!",
    body: (title, needed, written) => `"${title}": ${needed.toLocaleString('en-US')} characters needed, ${written.toLocaleString('en-US')} written`
  }
}

async function getSettingValue(key) {
  const rows = await queryDatabase('SELECT value FROM settings WHERE key = ?', [key])
  return rows.length > 0 ? rows[0].value : null
}

// Локальная дата YYYY-MM-DD — записи в renderer пишутся локальной датой,
// toISOString() здесь дал бы UTC-сдвиг (к западу от UTC вечером это уже «завтра»)
function localDateString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function checkAndNotifyProgress() {
  try {
    if (!Notification.isSupported()) return

    // Уважаем настройку пользователя (тумблер в Настройках)
    const notificationsEnabled = await getSettingValue('notificationsEnabled')
    if (notificationsEnabled !== 'true') return

    const lang = (await getSettingValue('language')) === 'en' ? 'en' : 'ru'
    const texts = NOTIFICATION_TEXTS[lang]

    const today = localDateString()

    // Суммарно написано сегодня
    const todayRows = await queryDatabase(
      'SELECT COALESCE(SUM(symbols), 0) as total FROM entries WHERE date = ?',
      [today]
    )
    const todaySymbols = todayRows[0]?.total || 0

    // Активные проекты с дедлайном
    const projects = await queryDatabase(
      "SELECT * FROM projects WHERE status = 'active' AND deadline IS NOT NULL AND targetSymbols IS NOT NULL"
    )

    for (const project of projects) {
      const daysLeft = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24))
      if (daysLeft <= 0) continue

      const writtenRows = await queryDatabase(
        'SELECT COALESCE(SUM(symbols), 0) as total FROM entries WHERE projectId = ?',
        [project.id]
      )
      const totalWritten = writtenRows[0]?.total || 0
      const remaining = Math.max((project.targetSymbols || 0) - totalWritten, 0)
      if (remaining <= 0) continue

      const neededToday = Math.ceil(remaining / daysLeft)
      if (todaySymbols >= neededToday * 0.5) continue // Уже на полпути — не беспокоим

      new Notification({
        title: texts.title,
        body: texts.body(project.title, neededToday, todaySymbols)
      }).show()
      break // Одно уведомление в день
    }
  } catch (error) {
    console.error('Evening reminder error:', error)
  }
}

// Расписание автоматических бэкапов
function scheduleBackups() {
  // Бэкап каждый день в 2:00
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(2, 0, 0, 0)
  
  const msUntilBackup = tomorrow.getTime() - now.getTime()
  
  setTimeout(() => {
    // Создаём бэкап
    backupDatabase().then(path => {
      console.log('Automatic backup created:', path)
    }).catch(error => {
      console.error('Automatic backup error:', error)
    })
    
    // Планируем следующий бэкап (каждый день)
    setInterval(() => {
      backupDatabase().then(path => {
        console.log('Automatic backup created:', path)
      }).catch(error => {
        console.error('Automatic backup error:', error)
      })
    }, 24 * 60 * 60 * 1000) // 24 часа
  }, msUntilBackup)
}

// Инициализация приложения
app.whenReady().then(async () => {
  // Инициализируем БД
  try {
    await initDatabase()
    console.log('Database initialized')

    // Язык меню/уведомлений — из настроек (renderer дублирует выбор языка в settings)
    const savedLang = await getSettingValue('language').catch(() => null)
    if (savedLang === 'en') currentLang = 'en'

    // Поведение «сворачивать в трей» — из настроек
    const savedTray = await getSettingValue('trayOnClose').catch(() => null)
    trayOnClose = savedTray === 'true'
    if (trayOnClose) ensureTray()

    // Запускаем расписание бэкапов и вечерних напоминаний
    scheduleBackups()
    scheduleEveningReminder()
  } catch (error) {
    console.error('Database initialization error:', error)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers для работы с БД
ipcMain.handle('db-query', async (event, query, params = []) => {
  try {
    return await queryDatabase(query, params)
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
})

ipcMain.handle('db-exec', async (event, query, params = []) => {
  try {
    return await queryDatabase(query, params)
  } catch (error) {
    console.error('Database exec error:', error)
    throw error
  }
})

ipcMain.handle('db-backup', async () => {
  try {
    const backupPath = await backupDatabase()
    return { success: true, path: backupPath }
  } catch (error) {
    console.error('Backup error:', error)
    return { success: false, error: error.message }
  }
})

// Обработка закрытия приложения
app.on('before-quit', () => {
  isQuitting = true
})
