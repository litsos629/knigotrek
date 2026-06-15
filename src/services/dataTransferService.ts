// Общий сервис экспорта/импорта данных файлом (используется в Настройках и на странице синхронизации)
import {
  getEntries, getProjects, getSessions, getNotes, getChapters,
  saveEntry, saveProject, saveSession, saveNote, saveChapter,
  type Entry, type Project, type Session, type Note, type Chapter
} from './databaseService'
import { format } from 'date-fns'

export interface ExportData {
  version: string
  exportDate: string
  entries: Entry[]
  projects: Project[]
  sessions: Session[]
  notes: Note[]
  chapters: Chapter[]
}

export interface ImportCounts {
  entries: number
  projects: number
  sessions: number
  notes: number
  chapters: number
}

export async function buildExportData(): Promise<ExportData> {
  return {
    version: '1.1',
    exportDate: new Date().toISOString(),
    entries: await getEntries(),
    projects: await getProjects(),
    sessions: await getSessions(),
    notes: await getNotes(),
    chapters: await getChapters(),
  }
}

export function downloadAsFile(data: ExportData, prefix = 'knigotrek-backup'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prefix}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function isValidImportData(data: unknown): data is Partial<ExportData> {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return typeof d.version === 'string' && Array.isArray(d.entries) && Array.isArray(d.projects)
}

/**
 * Импорт с объединением. Проекты/сессии/заметки/главы — upsert по своему id.
 * Записи символов — слияние по ключу (date, projectId): числовые id автоинкрементны
 * и различаются между устройствами, поэтому id из файла не переносится; при совпадении
 * дня берётся максимум написанного/удалённого (повторный импорт ничего не задвоит).
 */
export async function importData(data: Partial<ExportData>): Promise<ImportCounts> {
  const counts: ImportCounts = { entries: 0, projects: 0, sessions: 0, notes: 0, chapters: 0 }

  for (const project of data.projects ?? []) {
    if (await saveProject(project)) counts.projects++
  }
  for (const chapter of data.chapters ?? []) {
    if (await saveChapter(chapter)) counts.chapters++
  }
  for (const session of data.sessions ?? []) {
    if (await saveSession(session)) counts.sessions++
  }
  for (const note of data.notes ?? []) {
    if (await saveNote(note)) counts.notes++
  }

  if (data.entries?.length) {
    const existing = await getEntries()
    const keyOf = (e: Pick<Entry, 'date' | 'projectId'>) => `${e.date}|${e.projectId ?? ''}`
    const byKey = new Map(existing.map(e => [keyOf(e), e]))
    for (const entry of data.entries) {
      if (!entry?.date) continue
      const local = byKey.get(keyOf(entry))
      if (local) {
        const merged: Entry = {
          ...local,
          symbols: Math.max(local.symbols, entry.symbols || 0),
          deleted: Math.max(local.deleted ?? 0, entry.deleted ?? 0),
        }
        if (merged.symbols !== local.symbols || (merged.deleted ?? 0) !== (local.deleted ?? 0)) {
          if (await saveEntry(merged)) {
            counts.entries++
            byKey.set(keyOf(merged), merged)
          }
        }
      } else {
        const fresh: Entry = {
          date: entry.date,
          symbols: entry.symbols || 0,
          deleted: entry.deleted ?? 0,
          projectId: entry.projectId,
        }
        if (await saveEntry(fresh)) {
          counts.entries++
          byKey.set(keyOf(fresh), fresh)
        }
      }
    }
  }

  return counts
}
