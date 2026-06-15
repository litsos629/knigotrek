import { contextBridge, ipcRenderer } from 'electron'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Безопасный мост между Electron и React
contextBridge.exposeInMainWorld('electronAPI', {
  // Работа с БД
  dbQuery: (query, params) => ipcRenderer.invoke('db-query', query, params),
  dbExec: (query, params) => ipcRenderer.invoke('db-exec', query, params),
  dbBackup: () => ipcRenderer.invoke('db-backup'),

  // Платформа
  platform: process.platform,
  isElectron: true,

  // События меню — callback получает имя действия
  onMenuAction: (callback) => {
    const channels = ['menu-export-data', 'menu-import-data', 'menu-about']
    channels.forEach(channel => ipcRenderer.on(channel, () => callback(channel)))
  },

  // Язык приложения → main-процесс (локализация меню и системных уведомлений)
  setAppLanguage: (lng) => ipcRenderer.send('app-language-changed', lng),

  // Настройка «сворачивать в трей при закрытии» → main-процесс
  setTrayOnClose: (enabled) => ipcRenderer.send('tray-on-close-changed', enabled),

  // Утилиты
  getVersion: () => process.versions.electron,
  getAppVersion: () => {
    const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))
    return packageJson.version
  }
})
