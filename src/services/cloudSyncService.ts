import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  getEntries, getProjects, getSessions, getNotes, getChapters, getSetting,
  saveEntry, saveProject, saveSession, saveNote, saveChapter,
  type Entry, type Project, type Session, type Note, type Chapter
} from './databaseService'
import i18n from '../i18n'

/** Перевод строки из namespace по умолчанию (`common`). */
const t = (key: string): string => i18n.t(key) as string

// ========== Init ==========

let _supabase: SupabaseClient | null = null
const SYNC_DOMAIN = '@sync.knigotrek.app'
const LAST_SYNC_KEY = 'knigotrek_last_sync'
const SYNC_KEY_STORAGE = 'knigotrek_sync_key'
const SYNC_METHOD_STORAGE = 'knigotrek_sync_method'

export function initSupabase(): void {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (url && anonKey) {
    _supabase = createClient(url, anonKey)
  }
}

export function isConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

function getClient(): SupabaseClient {
  if (!_supabase) throw new Error(t('errors.supabaseNotInit'))
  return _supabase
}

// ========== Timestamps ==========

/**
 * SQLite пишет метки как "YYYY-MM-DD HH:MM:SS" (UTC, без 'T' и 'Z'),
 * а lastSync хранится в ISO. Строковое сравнение между форматами ломается
 * (' ' < 'T'), поэтому всё переводим в миллисекунды.
 */
export function tsToMillis(ts?: string | null): number {
  if (!ts) return 0
  const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z'
  const ms = Date.parse(normalized)
  return Number.isNaN(ms) ? 0 : ms
}

/** Метка в ISO для отправки на сервер (timestamptz). */
export function tsToIso(ts?: string | null): string {
  const ms = tsToMillis(ts)
  return ms > 0 ? new Date(ms).toISOString() : new Date().toISOString()
}

// ========== Auth ==========

export async function signInWithSyncKey(syncKey: string): Promise<void> {
  const sb = getClient()
  const email = `sync-${syncKey}${SYNC_DOMAIN}`
  const { error } = await sb.auth.signInWithPassword({ email, password: syncKey })
  if (error) {
    if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('not found') || error.status === 400) {
      const { error: signUpError } = await sb.auth.signUp({ email, password: syncKey })
      if (signUpError) throw new Error(signUpError.message)
    } else {
      throw new Error(error.message)
    }
  }
  localStorage.setItem(SYNC_KEY_STORAGE, syncKey)
  localStorage.setItem(SYNC_METHOD_STORAGE, 'key')
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const sb = getClient()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  localStorage.setItem(SYNC_METHOD_STORAGE, 'email')
}

export async function signUp(email: string, password: string): Promise<void> {
  const sb = getClient()
  const { error } = await sb.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  localStorage.setItem(SYNC_METHOD_STORAGE, 'email')
}

export async function signOut(): Promise<void> {
  const sb = getClient()
  await sb.auth.signOut()
  localStorage.removeItem(SYNC_KEY_STORAGE)
  localStorage.removeItem(SYNC_METHOD_STORAGE)
  localStorage.removeItem(LAST_SYNC_KEY)
}

export async function getCurrentUser(): Promise<User | null> {
  if (!_supabase) return null
  const { data } = await _supabase.auth.getUser()
  return data.user ?? null
}

export async function restoreSession(): Promise<void> {
  if (!_supabase) return
  const method = localStorage.getItem(SYNC_METHOD_STORAGE)
  const syncKey = localStorage.getItem(SYNC_KEY_STORAGE)
  if (method === 'key' && syncKey) {
    try { await signInWithSyncKey(syncKey) } catch { /* ignore, session may still be valid */ }
  }
  // For email method, Supabase auto-restores session from its own storage
}

export function getSavedSyncKey(): string | null {
  return localStorage.getItem(SYNC_KEY_STORAGE)
}

export function getSyncMethod(): string | null {
  return localStorage.getItem(SYNC_METHOD_STORAGE)
}

export function generateSyncKey(): string {
  return crypto.randomUUID()
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY)
}

// ========== Sync ==========

export interface SyncResult {
  pushed: number
  pulled: number
  errors: string[]
}

export async function syncAll(): Promise<SyncResult> {
  const sb = getClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error(t('errors.notAuthorized'))

  const lastSync = localStorage.getItem(LAST_SYNC_KEY) ?? '1970-01-01T00:00:00.000Z'
  const syncStart = new Date().toISOString()
  const uid = user.id
  const errors: string[] = []
  let pushed = 0
  let pulled = 0

  // ---- PUSH ----
  try { pushed += await pushEntries(sb, uid, lastSync) } catch (e) { errors.push(`entries push: ${(e as Error).message}`) }
  try { pushed += await pushProjects(sb, uid, lastSync) } catch (e) { errors.push(`projects push: ${(e as Error).message}`) }
  try { pushed += await pushChapters(sb, uid, lastSync) } catch (e) { errors.push(`chapters push: ${(e as Error).message}`) }
  try { pushed += await pushSessions(sb, uid, lastSync) } catch (e) { errors.push(`sessions push: ${(e as Error).message}`) }
  try { pushed += await pushNotes(sb, uid, lastSync) } catch (e) { errors.push(`notes push: ${(e as Error).message}`) }
  try { await pushSettings(sb, uid) } catch (e) { errors.push(`settings push: ${(e as Error).message}`) }

  // ---- PULL ----
  try { pulled += await pullEntries(sb, uid, lastSync) } catch (e) { errors.push(`entries pull: ${(e as Error).message}`) }
  try { pulled += await pullProjects(sb, uid, lastSync) } catch (e) { errors.push(`projects pull: ${(e as Error).message}`) }
  try { pulled += await pullChapters(sb, uid, lastSync) } catch (e) { errors.push(`chapters pull: ${(e as Error).message}`) }
  try { pulled += await pullSessions(sb, uid, lastSync) } catch (e) { errors.push(`sessions pull: ${(e as Error).message}`) }
  try { pulled += await pullNotes(sb, uid, lastSync) } catch (e) { errors.push(`notes pull: ${(e as Error).message}`) }
  try { await pullSettings(sb, uid) } catch (e) { errors.push(`settings pull: ${(e as Error).message}`) }

  if (errors.length === 0) {
    localStorage.setItem(LAST_SYNC_KEY, syncStart)
  }
  return { pushed, pulled, errors }
}

// ---- Push helpers ----

/** Изменено после последней синхронизации (сравнение в миллисекундах, не строками). */
function changedSince(updatedAt: string | undefined, createdAt: string | undefined, lastSync: string): boolean {
  return tsToMillis(updatedAt ?? createdAt) >= tsToMillis(lastSync)
}

async function pushEntries(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const entries = await getEntries()
  const toSync = entries.filter(e => changedSince(e.updatedAt, e.createdAt, lastSync) || !e.syncId)
  if (toSync.length === 0) return 0
  const rows = toSync.map(e => ({
    user_id: uid,
    sync_id: e.syncId ?? crypto.randomUUID(),
    date: e.date,
    symbols: e.symbols,
    deleted: e.deleted ?? 0,
    project_id: e.projectId ?? null,
    created_at: e.createdAt ? tsToIso(e.createdAt) : null,
    updated_at: tsToIso(e.updatedAt),
  }))
  const { error } = await sb.from('sync_entries').upsert(rows, { onConflict: 'user_id,sync_id' })
  if (error) throw new Error(error.message)
  return rows.length
}

async function pushProjects(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const projects = await getProjects()
  const toSync = projects.filter(p => changedSince(p.updatedAt, p.createdAt, lastSync))
  if (toSync.length === 0) return 0
  const rows = toSync.map(p => ({
    user_id: uid,
    id: p.id,
    title: p.title,
    genre: p.genre ?? null,
    target_symbols: p.targetSymbols,
    deadline: p.deadline,
    status: p.status,
    phase: p.phase ?? 'draft',
    start_date: p.startDate,
    completed_date: p.completedDate ?? null,
    description: p.description ?? null,
    unfreeze_count: p.unfreezeCount ?? 0,
    is_hidden: p.isHidden ?? false,
    created_at: p.createdAt ? tsToIso(p.createdAt) : null,
    updated_at: tsToIso(p.updatedAt),
  }))
  const { error } = await sb.from('sync_projects').upsert(rows, { onConflict: 'user_id,id' })
  if (error) throw new Error(error.message)
  return rows.length
}

async function pushChapters(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const chapters = await getChapters()
  const toSync = chapters.filter(c => changedSince(c.updatedAt, c.createdAt, lastSync))
  if (toSync.length === 0) return 0
  const rows = toSync.map(c => ({
    user_id: uid,
    id: c.id,
    project_id: c.projectId,
    title: c.title,
    status: c.status,
    position: c.position,
    created_at: c.createdAt ? tsToIso(c.createdAt) : null,
    updated_at: tsToIso(c.updatedAt),
  }))
  const { error } = await sb.from('sync_chapters').upsert(rows, { onConflict: 'user_id,id' })
  if (error) throw new Error(error.message)
  return rows.length
}

async function pushSessions(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const sessions = await getSessions()
  const toSync = sessions.filter(s => changedSince(s.updatedAt, s.createdAt, lastSync))
  if (toSync.length === 0) return 0
  const rows = toSync.map(s => ({
    user_id: uid,
    id: s.id,
    date: s.date,
    duration: s.duration,
    planned_duration: s.plannedDuration,
    symbols: s.symbols,
    speed: s.speed,
    mood: s.mood ?? null,
    tags: s.tags && s.tags.length > 0 ? JSON.stringify(s.tags) : null,
    note: s.note ?? null,
    project_id: s.projectId ?? null,
    created_at: s.createdAt ? tsToIso(s.createdAt) : null,
    updated_at: tsToIso(s.updatedAt),
  }))
  const { error } = await sb.from('sync_sessions').upsert(rows, { onConflict: 'user_id,id' })
  if (error) throw new Error(error.message)
  return rows.length
}

async function pushNotes(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const notes = await getNotes()
  const toSync = notes.filter(n => changedSince(n.updatedAt, n.date, lastSync))
  if (toSync.length === 0) return 0
  const rows = toSync.map(n => ({
    user_id: uid,
    id: n.id,
    title: n.title,
    content: n.content ?? null,
    date: n.date,
    updated_at: tsToIso(n.updatedAt),
  }))
  const { error } = await sb.from('sync_notes').upsert(rows, { onConflict: 'user_id,id' })
  if (error) throw new Error(error.message)
  return rows.length
}

async function pushSettings(sb: SupabaseClient, uid: string): Promise<void> {
  // Push key settings (not sensitive)
  const keys = ['notificationsEnabled', 'notificationTime', 'theme', 'onboardingCompleted']
  const rows = []
  for (const key of keys) {
    const value = await getSetting(key)
    if (value !== null && value !== undefined) {
      rows.push({ user_id: uid, key, value: String(value), updated_at: new Date().toISOString() })
    }
  }
  if (rows.length > 0) {
    await sb.from('sync_settings').upsert(rows, { onConflict: 'user_id,key' })
  }
}

// ---- Pull helpers ----

const isElectronEnv = () => typeof window !== 'undefined' && !!window.electronAPI

async function dbUpsert(query: string, params: any[]): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.dbExec(query, params)
  }
}

async function pullEntries(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const { data, error } = await sb.from('sync_entries')
    .select('*')
    .eq('user_id', uid)
    .gte('updated_at', lastSync)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  if (isElectronEnv()) {
    for (const row of data) {
      await dbUpsert(
        `INSERT INTO entries (syncId, date, symbols, deleted, projectId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(syncId) DO UPDATE SET
           date=excluded.date, symbols=excluded.symbols, deleted=excluded.deleted,
           projectId=excluded.projectId, updatedAt=excluded.updatedAt
         WHERE excluded.updatedAt > entries.updatedAt`,
        [row.sync_id, row.date, row.symbols, row.deleted ?? 0, row.project_id ?? null, row.created_at ?? null, row.updated_at]
      )
    }
  } else {
    // Браузер: merge через databaseService (раньше pull в вебе был молчаливым no-op)
    const local = await getEntries()
    const bySyncId = new Map(local.map(e => [e.syncId, e]))
    for (const row of data) {
      const existing = bySyncId.get(row.sync_id)
      if (existing && tsToMillis(existing.updatedAt) >= tsToMillis(row.updated_at)) continue
      const entry: Entry = {
        ...(existing ?? {}),
        date: row.date,
        symbols: row.symbols,
        deleted: row.deleted ?? 0,
        projectId: row.project_id ?? undefined,
        syncId: row.sync_id,
      }
      await saveEntry(entry)
    }
  }
  return data.length
}

async function pullProjects(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const { data, error } = await sb.from('sync_projects')
    .select('*')
    .eq('user_id', uid)
    .gte('updated_at', lastSync)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  if (isElectronEnv()) {
    for (const row of data) {
      await dbUpsert(
        `INSERT INTO projects (id, title, genre, targetSymbols, deadline, status, phase, startDate, completedDate, description, unfreezeCount, isHidden, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, genre=excluded.genre, targetSymbols=excluded.targetSymbols,
           deadline=excluded.deadline, status=excluded.status, phase=excluded.phase,
           startDate=excluded.startDate, completedDate=excluded.completedDate,
           description=excluded.description, unfreezeCount=excluded.unfreezeCount,
           isHidden=excluded.isHidden, updatedAt=excluded.updatedAt
         WHERE excluded.updatedAt > projects.updatedAt`,
        [row.id, row.title, row.genre ?? null, row.target_symbols ?? 0, row.deadline, row.status,
         row.phase ?? 'draft', row.start_date, row.completed_date ?? null, row.description ?? null,
         row.unfreeze_count ?? 0, row.is_hidden ? 1 : 0, row.created_at ?? null, row.updated_at]
      )
    }
  } else {
    const local = await getProjects()
    const byId = new Map(local.map(p => [p.id, p]))
    for (const row of data) {
      const existing = byId.get(row.id)
      if (existing && tsToMillis(existing.updatedAt) >= tsToMillis(row.updated_at)) continue
      const project: Project = {
        id: row.id,
        title: row.title,
        genre: row.genre ?? '',
        targetSymbols: row.target_symbols ?? 0,
        deadline: row.deadline ?? '',
        status: row.status ?? 'active',
        phase: row.phase ?? 'draft',
        startDate: row.start_date ?? '',
        completedDate: row.completed_date ?? undefined,
        description: row.description ?? undefined,
        unfreezeCount: row.unfreeze_count ?? 0,
        isHidden: !!row.is_hidden,
        createdAt: row.created_at ?? undefined,
      }
      await saveProject(project)
    }
  }
  return data.length
}

async function pullChapters(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const { data, error } = await sb.from('sync_chapters')
    .select('*')
    .eq('user_id', uid)
    .gte('updated_at', lastSync)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  if (isElectronEnv()) {
    for (const row of data) {
      await dbUpsert(
        `INSERT INTO chapters (id, projectId, title, status, position, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           projectId=excluded.projectId, title=excluded.title, status=excluded.status,
           position=excluded.position, updatedAt=excluded.updatedAt
         WHERE excluded.updatedAt > chapters.updatedAt`,
        [row.id, row.project_id, row.title, row.status ?? 'planned', row.position ?? 0, row.created_at ?? null, row.updated_at]
      )
    }
  } else {
    const local = await getChapters()
    const byId = new Map(local.map(c => [c.id, c]))
    for (const row of data) {
      const existing = byId.get(row.id)
      if (existing && tsToMillis(existing.updatedAt) >= tsToMillis(row.updated_at)) continue
      const chapter: Chapter = {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        status: row.status ?? 'planned',
        position: row.position ?? 0,
        createdAt: row.created_at ?? undefined,
      }
      await saveChapter(chapter)
    }
  }
  return data.length
}

async function pullSessions(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const { data, error } = await sb.from('sync_sessions')
    .select('*')
    .eq('user_id', uid)
    .gte('updated_at', lastSync)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  if (isElectronEnv()) {
    for (const row of data) {
      await dbUpsert(
        `INSERT INTO sessions (id, date, duration, plannedDuration, symbols, speed, mood, tags, note, projectId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           duration=excluded.duration, plannedDuration=excluded.plannedDuration, symbols=excluded.symbols,
           speed=excluded.speed, mood=excluded.mood, tags=excluded.tags, note=excluded.note,
           projectId=excluded.projectId, updatedAt=excluded.updatedAt
         WHERE excluded.updatedAt > sessions.updatedAt`,
        [row.id, row.date, row.duration, row.planned_duration, row.symbols, row.speed,
         row.mood ?? null, row.tags ?? null, row.note ?? null, row.project_id ?? null, row.created_at ?? null, row.updated_at]
      )
    }
  } else {
    const local = await getSessions()
    const byId = new Map(local.map(s => [s.id, s]))
    for (const row of data) {
      const existing = byId.get(row.id)
      if (existing && tsToMillis(existing.updatedAt) >= tsToMillis(row.updated_at)) continue
      let tags: string[] | undefined
      try { tags = row.tags ? JSON.parse(row.tags) : undefined } catch { tags = undefined }
      const session: Session = {
        id: row.id,
        date: row.date,
        duration: row.duration ?? 0,
        plannedDuration: row.planned_duration ?? 0,
        symbols: row.symbols ?? 0,
        speed: row.speed ?? 0,
        mood: row.mood ?? undefined,
        tags,
        note: row.note ?? undefined,
        projectId: row.project_id ?? undefined,
        createdAt: row.created_at ?? undefined,
      }
      await saveSession(session)
    }
  }
  return data.length
}

async function pullNotes(sb: SupabaseClient, uid: string, lastSync: string): Promise<number> {
  const { data, error } = await sb.from('sync_notes')
    .select('*')
    .eq('user_id', uid)
    .gte('updated_at', lastSync)
  if (error) throw new Error(error.message)
  if (!data?.length) return 0

  if (isElectronEnv()) {
    for (const row of data) {
      await dbUpsert(
        `INSERT INTO notes (id, title, content, date, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, content=excluded.content, updatedAt=excluded.updatedAt
         WHERE excluded.updatedAt > notes.updatedAt`,
        [row.id, row.title, row.content ?? null, row.date ?? null, row.updated_at]
      )
    }
  } else {
    const local = await getNotes()
    const byId = new Map(local.map(n => [n.id, n]))
    for (const row of data) {
      const existing = byId.get(row.id)
      if (existing && tsToMillis(existing.updatedAt) >= tsToMillis(row.updated_at)) continue
      const note: Note = {
        id: row.id,
        title: row.title,
        content: row.content ?? '',
        date: row.date ?? new Date().toISOString(),
      }
      await saveNote(note)
    }
  }
  return data.length
}

async function pullSettings(sb: SupabaseClient, uid: string): Promise<void> {
  const { data, error } = await sb.from('sync_settings')
    .select('*')
    .eq('user_id', uid)
  if (error || !data?.length) return
  for (const row of data) {
    await dbUpsert(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [row.key, row.value]
    )
  }
}
