import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as databaseService from '../databaseService'
import { buildExportData, importData, isValidImportData } from '../dataTransferService'

vi.mock('../databaseService')

describe('dataTransferService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(databaseService.getEntries).mockResolvedValue([])
    vi.mocked(databaseService.getProjects).mockResolvedValue([])
    vi.mocked(databaseService.getSessions).mockResolvedValue([])
    vi.mocked(databaseService.getNotes).mockResolvedValue([])
    vi.mocked(databaseService.getChapters).mockResolvedValue([])
    vi.mocked(databaseService.saveEntry).mockResolvedValue(true)
    vi.mocked(databaseService.saveProject).mockResolvedValue(true)
    vi.mocked(databaseService.saveSession).mockResolvedValue(true)
    vi.mocked(databaseService.saveNote).mockResolvedValue(true)
    vi.mocked(databaseService.saveChapter).mockResolvedValue(true)
  })

  describe('buildExportData', () => {
    it('включает все сущности и версию', async () => {
      const data = await buildExportData()
      expect(data.version).toBe('1.1')
      expect(data).toHaveProperty('entries')
      expect(data).toHaveProperty('projects')
      expect(data).toHaveProperty('sessions')
      expect(data).toHaveProperty('notes')
      expect(data).toHaveProperty('chapters')
      expect(databaseService.getChapters).toHaveBeenCalled()
    })
  })

  describe('isValidImportData', () => {
    it('принимает корректный формат', () => {
      expect(isValidImportData({ version: '1.0', entries: [], projects: [] })).toBe(true)
    })
    it('отклоняет мусор', () => {
      expect(isValidImportData(null)).toBe(false)
      expect(isValidImportData('строка')).toBe(false)
      expect(isValidImportData({ entries: [] })).toBe(false)
      expect(isValidImportData({ version: '1.0', entries: 'нет', projects: [] })).toBe(false)
    })
  })

  describe('importData — записи', () => {
    it('новая запись вставляется без числового id (id различаются между устройствами)', async () => {
      await importData({ entries: [{ id: 42, date: '2024-01-26', symbols: 500 }] })
      expect(databaseService.saveEntry).toHaveBeenCalledTimes(1)
      const saved = vi.mocked(databaseService.saveEntry).mock.calls[0][0]
      expect(saved.id).toBeUndefined()
      expect(saved).toMatchObject({ date: '2024-01-26', symbols: 500 })
    })

    it('при совпадении (date, projectId) берётся максимум символов, локальный id сохраняется', async () => {
      vi.mocked(databaseService.getEntries).mockResolvedValue([
        { id: 1, date: '2024-01-26', symbols: 300, projectId: 'p1' }
      ])
      await importData({ entries: [{ id: 99, date: '2024-01-26', symbols: 500, projectId: 'p1' }] })
      expect(databaseService.saveEntry).toHaveBeenCalledTimes(1)
      expect(vi.mocked(databaseService.saveEntry).mock.calls[0][0]).toMatchObject({
        id: 1, date: '2024-01-26', symbols: 500, projectId: 'p1'
      })
    })

    it('повторный импорт того же файла ничего не меняет (идемпотентность)', async () => {
      vi.mocked(databaseService.getEntries).mockResolvedValue([
        { id: 1, date: '2024-01-26', symbols: 500, deleted: 0 }
      ])
      const counts = await importData({ entries: [{ id: 7, date: '2024-01-26', symbols: 500 }] })
      expect(databaseService.saveEntry).not.toHaveBeenCalled()
      expect(counts.entries).toBe(0)
    })

    it('записи разных проектов за один день не смешиваются', async () => {
      vi.mocked(databaseService.getEntries).mockResolvedValue([
        { id: 1, date: '2024-01-26', symbols: 300, projectId: 'p1' }
      ])
      await importData({ entries: [{ date: '2024-01-26', symbols: 200, projectId: 'p2' }] })
      const saved = vi.mocked(databaseService.saveEntry).mock.calls[0][0]
      expect(saved.projectId).toBe('p2')
      expect(saved.symbols).toBe(200)
    })
  })

  describe('importData — остальные сущности', () => {
    it('проекты/сессии/заметки/главы передаются в соответствующие save-функции', async () => {
      const counts = await importData({
        projects: [{ id: 'p1', title: 'Роман', genre: 'fantasy', targetSymbols: 1000, deadline: '', status: 'active', startDate: '2024-01-01' }],
        sessions: [{ id: 's1', date: '2024-01-26T10:00:00Z', duration: 25, plannedDuration: 25, symbols: 100, speed: 4 }],
        notes: [{ id: 'n1', title: 'Идея', content: 'Текст', date: '2024-01-26' }],
        chapters: [{ id: 'c1', projectId: 'p1', title: 'Глава 1', status: 'planned', position: 0 }],
      })
      expect(databaseService.saveProject).toHaveBeenCalledTimes(1)
      expect(databaseService.saveSession).toHaveBeenCalledTimes(1)
      expect(databaseService.saveNote).toHaveBeenCalledTimes(1)
      expect(databaseService.saveChapter).toHaveBeenCalledTimes(1)
      expect(counts).toMatchObject({ projects: 1, sessions: 1, notes: 1, chapters: 1 })
    })
  })
})
