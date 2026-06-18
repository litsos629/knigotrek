import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import ruCommon from './locales/ru/common.json'
import enCommon from './locales/en/common.json'
import ruSettings from './locales/ru/settings.json'
import enSettings from './locales/en/settings.json'
import ruHome from './locales/ru/home.json'
import enHome from './locales/en/home.json'
import ruProjects from './locales/ru/projects.json'
import enProjects from './locales/en/projects.json'
import ruFocus from './locales/ru/focus.json'
import enFocus from './locales/en/focus.json'
import ruNotes from './locales/ru/notes.json'
import enNotes from './locales/en/notes.json'
import ruSync from './locales/ru/sync.json'
import enSync from './locales/en/sync.json'
import ruReports from './locales/ru/reports.json'
import enReports from './locales/en/reports.json'
import ruModals from './locales/ru/modals.json'
import enModals from './locales/en/modals.json'
import ruAssistant from './locales/ru/assistant.json'
import enAssistant from './locales/en/assistant.json'
import ruConfig from './locales/ru/config.json'
import enConfig from './locales/en/config.json'
import ruAchievements from './locales/ru/achievements.json'
import enAchievements from './locales/en/achievements.json'

export type Lang = 'ru' | 'en'
const STORAGE_KEY = 'knigotrek_lang'

export const NAMESPACES = [
  'common', 'settings', 'home', 'projects', 'focus', 'notes', 'sync', 'reports', 'modals', 'assistant', 'config', 'achievements',
] as const

/** Определяет начальный язык: сохранённый выбор → системный → ru. */
export function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ru' || saved === 'en') return saved
  } catch {
    /* localStorage недоступен */
  }
  const sys = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : '').toLowerCase()
  return sys.startsWith('ru') ? 'ru' : 'en'
}

export const resources = {
  ru: {
    common: ruCommon, settings: ruSettings, home: ruHome, projects: ruProjects,
    focus: ruFocus, notes: ruNotes, sync: ruSync, reports: ruReports, modals: ruModals,
    assistant: ruAssistant, config: ruConfig, achievements: ruAchievements,
  },
  en: {
    common: enCommon, settings: enSettings, home: enHome, projects: enProjects,
    focus: enFocus, notes: enNotes, sync: enSync, reports: enReports, modals: enModals,
    assistant: enAssistant, config: enConfig, achievements: enAchievements,
  },
} as const

i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLang(),
  fallbackLng: 'ru',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React сам экранирует
})

// Атрибут lang на <html> следует за языком приложения (доступность, спеллчек)
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
  i18n.on('languageChanged', lng => {
    document.documentElement.lang = lng
  })
}

/** Меняет язык приложения и запоминает выбор. */
export function setLanguage(lng: Lang): void {
  i18n.changeLanguage(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* localStorage недоступен */
  }
  persistLanguageForMainProcess(lng)
}

/**
 * Дублирует язык в таблицу settings (SQLite), чтобы main-процесс Electron
 * мог локализовать меню и системные уведомления. Динамический импорт —
 * чтобы не создавать цикл i18n ↔ databaseService.
 */
export function persistLanguageForMainProcess(lng: Lang): void {
  import('../services/databaseService')
    .then(db => db.setSetting('language', lng))
    .catch(() => { /* не критично */ })
  // Живое обновление меню Electron без перезапуска
  if (typeof window !== 'undefined') window.electronAPI?.setAppLanguage?.(lng)
}

/** Текущий язык приложения. */
export function getLanguage(): Lang {
  return i18n.language === 'en' ? 'en' : 'ru'
}

export default i18n
