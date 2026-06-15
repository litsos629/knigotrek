// Сервис для работы с базой данных (SQLite в Electron или localStorage в браузере)
import i18n from '../i18n'
import { todayLocal } from '../utils/dates'

/** Перевод строки из namespace по умолчанию (`common`). */
const t = (key: string): string => i18n.t(key) as string

declare global {
  interface Window {
    electronAPI?: {
      dbQuery: (query: string, params?: any[]) => Promise<any>
      dbExec: (query: string, params?: any[]) => Promise<any>
      dbBackup: () => Promise<{ success: boolean; path?: string; error?: string }>
      isElectron?: boolean
      /** Подписка на пункты меню Electron (имя действия: menu-export-data | menu-import-data | menu-about) */
      onMenuAction?: (callback: (action: string) => void) => void
      /** Сообщает main-процессу язык приложения (локализация меню/уведомлений) */
      setAppLanguage?: (lng: string) => void
      /** Сообщает main-процессу настройку «сворачивать в трей при закрытии» */
      setTrayOnClose?: (enabled: boolean) => void
    }
  }
}

// Проверка, работаем ли в Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

// Интерфейсы данных
export interface Entry {
  id?: number
  date: string
  symbols: number
  deleted?: number // удалённые символы (режим редактуры); по умолчанию 0
  projectId?: string
  createdAt?: string
  /** Стабильный id для облачной синхронизации (числовые id различаются между устройствами) */
  syncId?: string
  updatedAt?: string
}

export interface Project {
  id: string
  title: string
  genre: string
  targetSymbols: number
  deadline: string
  status: 'active' | 'completed' | 'paused'
  phase?: 'draft' | 'revision' // черновик / редактура; по умолчанию draft
  startDate: string
  completedDate?: string
  description?: string
  createdAt?: string
  unfreezeCount?: number
  isHidden?: boolean
  updatedAt?: string
}

export interface Chapter {
  id: string
  projectId: string
  title: string
  status: 'planned' | 'draft' | 'done' // план / черновик / готово
  position: number
  createdAt?: string
  updatedAt?: string
}

export interface Session {
  id: string
  date: string
  duration: number
  plannedDuration: number
  symbols: number
  speed: number
  mood?: string // deprecated: kept for backward compat, use tags
  tags?: string[]
  note?: string
  createdAt?: string
  projectId?: string // Опциональное поле для связи сессии с проектом
  updatedAt?: string
}

export interface Note {
  id: string
  title: string
  content: string
  date: string
  updatedAt?: string
}

// ========== VALIDATION ==========

function sanitizeString(str: string, maxLength: number): string {
  if (typeof str !== 'string') return ''
  return str.trim().slice(0, maxLength)
}

function validateWordCount(count: number): number {
  if (typeof count !== 'number' || isNaN(count) || count < 0) return 0
  return Math.floor(count)
}

function validateProjectInput(project: Project): string | null {
  if (!project.title || typeof project.title !== 'string' || project.title.trim().length === 0) {
    return t('validation.projectTitleEmpty')
  }
  if (project.title.length > 200) {
    return t('validation.projectTitleTooLong')
  }
  if (typeof project.targetSymbols !== 'number' || isNaN(project.targetSymbols) || project.targetSymbols < 0) {
    return t('validation.projectTargetInvalid')
  }
  if (project.description && project.description.length > 10000) {
    return t('validation.projectDescTooLong')
  }
  return null
}

function validateNoteInput(note: Note): string | null {
  if (!note.title || typeof note.title !== 'string' || note.title.trim().length === 0) {
    return t('validation.noteTitleEmpty')
  }
  if (note.title.length > 200) {
    return t('validation.noteTitleTooLong')
  }
  if (note.content && note.content.length > 10000) {
    return t('validation.noteContentTooLong')
  }
  return null
}

// ========== ENTRIES ==========

export async function getEntries(): Promise<Entry[]> {
  if (isElectron && window.electronAPI) {
    try {
      const result = await window.electronAPI.dbQuery(
        'SELECT * FROM entries ORDER BY date DESC'
      )
      return result.map((row: any) => ({
        id: row.id,
        date: row.date,
        symbols: row.symbols,
        deleted: row.deleted || 0,
        projectId: row.projectId || undefined,
        createdAt: row.createdAt,
        syncId: row.syncId || undefined,
        updatedAt: row.updatedAt || undefined
      }))
    } catch (error) {
      console.error('Error fetching entries:', error)
      return []
    }
  } else {
    // Fallback на localStorage
    const saved = localStorage.getItem('knigotrek-entries')
    return saved ? JSON.parse(saved) : []
  }
}

export async function saveEntry(entry: Entry): Promise<boolean> {
  // Валидация
  entry.symbols = validateWordCount(entry.symbols)
  entry.deleted = validateWordCount(entry.deleted || 0)
  entry.date = sanitizeString(entry.date, 30)
  if (!entry.date) {
    entry.date = todayLocal()
  }
  // Стабильный id для синхронизации присваивается при создании
  if (!entry.syncId) {
    entry.syncId = crypto.randomUUID()
  }

  if (isElectron && window.electronAPI) {
    try {
      if (entry.id) {
        // updatedAt обязателен: по нему облачная синхронизация понимает, что запись изменилась
        await window.electronAPI.dbExec(
          "UPDATE entries SET date = ?, symbols = ?, deleted = ?, projectId = ?, updatedAt = datetime('now') WHERE id = ?",
          [entry.date, entry.symbols, entry.deleted || 0, entry.projectId || null, entry.id]
        )
      } else {
        await window.electronAPI.dbExec(
          'INSERT INTO entries (date, symbols, deleted, projectId, syncId) VALUES (?, ?, ?, ?, ?)',
          [entry.date, entry.symbols, entry.deleted || 0, entry.projectId || null, entry.syncId]
        )
      }
      return true
    } catch (error) {
      console.error('Error saving entry:', error)
      return false
    }
  } else {
    // Fallback на localStorage
    try {
      const entries = await getEntries()
      const existingIndex = entries.findIndex(e => e.date === entry.date && e.projectId === entry.projectId)

      entry.updatedAt = new Date().toISOString()
      if (existingIndex >= 0) {
        // syncId существующей записи сохраняем — он стабилен между устройствами
        const keepSyncId = entries[existingIndex].syncId
        entries[existingIndex] = { ...entries[existingIndex], ...entry, syncId: keepSyncId ?? entry.syncId }
      } else {
        entries.push(entry)
      }

      localStorage.setItem('knigotrek-entries', JSON.stringify(entries))
      return true
    } catch (error) {
      console.error('Error saving entry to localStorage:', error)
      return false
    }
  }
}

export async function deleteEntry(id: number): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    try {
      await window.electronAPI.dbExec('DELETE FROM entries WHERE id = ?', [id])
      return true
    } catch (error) {
      console.error('Error deleting entry:', error)
      return false
    }
  } else {
    // Fallback на localStorage
    try {
      const entries = await getEntries()
      const filtered = entries.filter(e => e.id !== id)
      localStorage.setItem('knigotrek-entries', JSON.stringify(filtered))
      return true
    } catch (error) {
      console.error('Error deleting entry from localStorage:', error)
      return false
    }
  }
}

// ========== PROJECTS ==========

export async function getProjects(): Promise<Project[]> {
  if (isElectron && window.electronAPI) {
    try {
      const result = await window.electronAPI.dbQuery(
        'SELECT * FROM projects ORDER BY createdAt DESC'
      )
      return result.map((row: any) => ({
        id: row.id,
        title: row.title,
        genre: row.genre,
        targetSymbols: row.targetSymbols,
        deadline: row.deadline,
        status: row.status as 'active' | 'completed' | 'paused',
        phase: (row.phase as 'draft' | 'revision') || 'draft',
        startDate: row.startDate,
        completedDate: row.completedDate || undefined,
        description: row.description || undefined,
        createdAt: row.createdAt,
        unfreezeCount: row.unfreezeCount || 0,
        isHidden: row.isHidden ? true : false,
        updatedAt: row.updatedAt || undefined
      }))
    } catch (error) {
      console.error('Error fetching projects:', error)
      return []
    }
  } else {
    const saved = localStorage.getItem('knigotrek-projects')
    return saved ? JSON.parse(saved) : []
  }
}

export async function saveProject(project: Project): Promise<boolean> {
  const validationError = validateProjectInput(project)
  if (validationError) {
    console.error('Project validation error:', validationError)
    return false
  }
  project.title = sanitizeString(project.title, 200)
  if (project.description) project.description = sanitizeString(project.description, 10000)
  project.targetSymbols = validateWordCount(project.targetSymbols)

  if (isElectron && window.electronAPI) {
    try {
      // createdAt передаём явно: INSERT OR REPLACE иначе сбросил бы его на «сейчас»,
      // updatedAt не передаём — DEFAULT datetime('now') даст свежую метку для синхронизации
      await window.electronAPI.dbExec(
        `INSERT OR REPLACE INTO projects
        (id, title, genre, targetSymbols, deadline, status, phase, startDate, completedDate, description, unfreezeCount, isHidden, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
        [
          project.id,
          project.title,
          project.genre,
          project.targetSymbols,
          project.deadline,
          project.status,
          project.phase || 'draft',
          project.startDate,
          project.completedDate || null,
          project.description || null,
          project.unfreezeCount || 0,
          project.isHidden ? 1 : 0,
          project.createdAt || null
        ]
      )
      return true
    } catch (error) {
      console.error('Error saving project:', error)
      return false
    }
  } else {
    try {
      const projects = await getProjects()
      const existingIndex = projects.findIndex(p => p.id === project.id)

      project.updatedAt = new Date().toISOString()
      if (existingIndex >= 0) {
        projects[existingIndex] = project
      } else {
        projects.push(project)
      }

      localStorage.setItem('knigotrek-projects', JSON.stringify(projects))
      return true
    } catch (error) {
      console.error('Error saving project to localStorage:', error)
      return false
    }
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    try {
      await window.electronAPI.dbExec('DELETE FROM projects WHERE id = ?', [id])
      return true
    } catch (error) {
      console.error('Error deleting project:', error)
      return false
    }
  } else {
    try {
      const projects = await getProjects()
      const filtered = projects.filter(p => p.id !== id)
      localStorage.setItem('knigotrek-projects', JSON.stringify(filtered))
      return true
    } catch (error) {
      console.error('Error deleting project from localStorage:', error)
      return false
    }
  }
}

// ========== CHAPTERS ==========

export async function getChapters(projectId?: string): Promise<Chapter[]> {
  let all: Chapter[]
  if (isElectron && window.electronAPI) {
    try {
      const result = await window.electronAPI.dbQuery('SELECT * FROM chapters ORDER BY position ASC')
      all = result.map((row: any) => ({
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        status: (row.status as 'planned' | 'draft' | 'done') || 'planned',
        position: row.position || 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt || undefined
      }))
    } catch (error) {
      console.error('Error fetching chapters:', error)
      return []
    }
  } else {
    const saved = localStorage.getItem('knigotrek-chapters')
    all = saved ? JSON.parse(saved) : []
  }
  const filtered = projectId ? all.filter(c => c.projectId === projectId) : all
  return filtered.sort((a, b) => a.position - b.position)
}

export async function saveChapter(chapter: Chapter): Promise<boolean> {
  chapter.title = sanitizeString(chapter.title, 200)
  if (!chapter.title) return false

  if (isElectron && window.electronAPI) {
    try {
      await window.electronAPI.dbExec(
        `INSERT OR REPLACE INTO chapters (id, projectId, title, status, position, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
        [chapter.id, chapter.projectId, chapter.title, chapter.status, chapter.position, chapter.createdAt || null]
      )
      return true
    } catch (error) {
      console.error('Error saving chapter:', error)
      return false
    }
  } else {
    try {
      const saved = localStorage.getItem('knigotrek-chapters')
      const chapters: Chapter[] = saved ? JSON.parse(saved) : []
      const idx = chapters.findIndex(c => c.id === chapter.id)
      chapter.updatedAt = new Date().toISOString()
      if (idx >= 0) chapters[idx] = chapter
      else chapters.push(chapter)
      localStorage.setItem('knigotrek-chapters', JSON.stringify(chapters))
      return true
    } catch (error) {
      console.error('Error saving chapter to localStorage:', error)
      return false
    }
  }
}

export async function deleteChapter(id: string): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    try {
      await window.electronAPI.dbExec('DELETE FROM chapters WHERE id = ?', [id])
      return true
    } catch (error) {
      console.error('Error deleting chapter:', error)
      return false
    }
  } else {
    try {
      const saved = localStorage.getItem('knigotrek-chapters')
      const chapters: Chapter[] = saved ? JSON.parse(saved) : []
      localStorage.setItem('knigotrek-chapters', JSON.stringify(chapters.filter(c => c.id !== id)))
      return true
    } catch (error) {
      console.error('Error deleting chapter from localStorage:', error)
      return false
    }
  }
}

// ========== SESSIONS ==========

/** Теги хранятся в SQLite JSON-массивом в TEXT-колонке. */
function parseTags(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined
  } catch {
    return undefined
  }
}

export async function getSessions(): Promise<Session[]> {
  if (isElectron && window.electronAPI) {
    try {
      const result = await window.electronAPI.dbQuery(
        'SELECT * FROM sessions ORDER BY date DESC'
      )
      return result.map((row: any) => ({
        id: row.id,
        date: row.date,
        duration: row.duration,
        plannedDuration: row.plannedDuration,
        symbols: row.symbols,
        speed: row.speed,
        mood: row.mood || undefined,
        tags: parseTags(row.tags),
        note: row.note || undefined,
        projectId: row.projectId || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt || undefined
      }))
    } catch (error) {
      console.error('Error fetching sessions:', error)
      return []
    }
  } else {
    const saved = localStorage.getItem('knigotrek-sessions')
    return saved ? JSON.parse(saved) : []
  }
}

export async function saveSession(session: Session): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    try {
      await window.electronAPI.dbExec(
        `INSERT OR REPLACE INTO sessions
        (id, date, duration, plannedDuration, symbols, speed, mood, tags, note, projectId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
        [
          session.id,
          session.date,
          session.duration,
          session.plannedDuration,
          session.symbols,
          session.speed,
          session.mood || null,
          session.tags && session.tags.length > 0 ? JSON.stringify(session.tags) : null,
          session.note || null,
          session.projectId || null,
          session.createdAt || null
        ]
      )
      return true
    } catch (error) {
      console.error('Error saving session:', error)
      return false
    }
  } else {
    try {
      const sessions = await getSessions()
      const existingIndex = sessions.findIndex(s => s.id === session.id)

      session.updatedAt = new Date().toISOString()
      if (existingIndex >= 0) {
        sessions[existingIndex] = session
      } else {
        sessions.push(session)
      }

      localStorage.setItem('knigotrek-sessions', JSON.stringify(sessions))
      return true
    } catch (error) {
      console.error('Error saving session to localStorage:', error)
      return false
    }
  }
}

// ========== NOTES ==========

export async function getNotes(): Promise<Note[]> {
  if (isElectron && window.electronAPI) {
    try {
      const result = await window.electronAPI.dbQuery(
        'SELECT * FROM notes ORDER BY date DESC'
      )
      return result.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        date: row.date,
        updatedAt: row.updatedAt || undefined
      }))
    } catch (error) {
      console.error('Error fetching notes:', error)
      return []
    }
  } else {
    const saved = localStorage.getItem('knigotrek-notes')
    return saved ? JSON.parse(saved) : []
  }
}

export async function saveNote(note: Note): Promise<boolean> {
  const validationError = validateNoteInput(note)
  if (validationError) {
    console.error('Note validation error:', validationError)
    return false
  }
  note.title = sanitizeString(note.title, 200)
  note.content = sanitizeString(note.content, 10000)

  if (isElectron && window.electronAPI) {
    try {
      // date передаём явно — раньше колонка не записывалась, и каждое
      // редактирование заметки сбрасывало её дату на «сейчас»
      await window.electronAPI.dbExec(
        `INSERT OR REPLACE INTO notes (id, title, content, date, updatedAt)
         VALUES (?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
        [note.id, note.title, note.content, note.date || null]
      )
      return true
    } catch (error) {
      console.error('Error saving note:', error)
      return false
    }
  } else {
    try {
      const notes = await getNotes()
      const existingIndex = notes.findIndex(n => n.id === note.id)

      note.updatedAt = new Date().toISOString()
      if (existingIndex >= 0) {
        notes[existingIndex] = note
      } else {
        notes.push(note)
      }

      localStorage.setItem('knigotrek-notes', JSON.stringify(notes))
      return true
    } catch (error) {
      console.error('Error saving note to localStorage:', error)
      return false
    }
  }
}

export async function deleteNote(id: string): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    try {
      await window.electronAPI.dbExec('DELETE FROM notes WHERE id = ?', [id])
      return true
    } catch (error) {
      console.error('Error deleting note:', error)
      return false
    }
  } else {
    try {
      const notes = await getNotes()
      const filtered = notes.filter(n => n.id !== id)
      localStorage.setItem('knigotrek-notes', JSON.stringify(filtered))
      return true
    } catch (error) {
      console.error('Error deleting note from localStorage:', error)
      return false
    }
  }
}

// ========== SETTINGS ==========

export async function getSetting(key: string): Promise<string | null> {
  if (isElectron && window.electronAPI) {
    try {
      const result = await window.electronAPI.dbQuery(
        'SELECT value FROM settings WHERE key = ?',
        [key]
      )
      return result.length > 0 ? result[0].value : null
    } catch (error) {
      console.error('Error fetching setting:', error)
      return null
    }
  } else {
    try {
      const saved = localStorage.getItem('knigotrek-settings')
      if (saved) {
        const settings = JSON.parse(saved)
        return settings[key] || null
      }
      return null
    } catch (error) {
      console.error('Error fetching setting from localStorage:', error)
      return null
    }
  }
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    try {
      await window.electronAPI.dbExec(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      )
      return true
    } catch (error) {
      console.error('Error saving setting:', error)
      return false
    }
  } else {
    try {
      const saved = localStorage.getItem('knigotrek-settings')
      const settings = saved ? JSON.parse(saved) : {}
      settings[key] = value
      localStorage.setItem('knigotrek-settings', JSON.stringify(settings))
      return true
    } catch (error) {
      console.error('Error saving setting to localStorage:', error)
      return false
    }
  }
}

// ========== BACKUP ==========

export async function createBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
  if (isElectron && window.electronAPI) {
    try {
      return await window.electronAPI.dbBackup()
    } catch (error) {
      console.error('Error creating backup:', error)
      return { success: false, error: String(error) }
    }
  } else {
    // Для браузера создаём JSON файл
    try {
      const data = {
        entries: await getEntries(),
        projects: await getProjects(),
        sessions: await getSessions(),
        notes: await getNotes(),
        timestamp: new Date().toISOString()
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knigotrek-backup-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}
