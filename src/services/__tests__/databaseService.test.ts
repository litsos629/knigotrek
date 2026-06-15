import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getEntries,
  saveEntry,
  deleteEntry,
  getProjects,
  saveProject,
  deleteProject,
  getChapters,
  saveChapter,
  deleteChapter,
  getSessions,
  saveSession,
  getNotes,
  saveNote,
  deleteNote,
  getSetting,
  setSetting,
  createBackup,
  type Entry,
  type Project,
  type Session,
  type Note
} from '../databaseService'
import { resetElectronMock, setupElectronMock, mockElectronAPI } from '../../test/mocks/electronAPI'

describe('databaseService', () => {
  beforeEach(() => {
    localStorage.clear()
    resetElectronMock()
  })

  describe('Браузерный режим (localStorage)', () => {
    beforeEach(() => {
      // Убираем electronAPI для тестирования браузерного режима
      Object.defineProperty(window, 'electronAPI', {
        value: undefined,
        writable: true,
        configurable: true
      })
    })

    describe('Entries', () => {
      it('должен возвращать пустой массив при отсутствии записей', async () => {
        const entries = await getEntries()
        expect(entries).toEqual([])
      })

      it('должен сохранять новую запись', async () => {
        const entry: Entry = {
          date: '2024-01-26',
          symbols: 500,
          projectId: 'project1'
        }

        await saveEntry(entry)
        const entries = await getEntries()
        
        expect(entries).toHaveLength(1)
        expect(entries[0].symbols).toBe(500)
        expect(entries[0].date).toBe('2024-01-26')
        expect(entries[0].projectId).toBe('project1')
      })

      it('должен сохранять удалённые символы (режим редактуры)', async () => {
        const entry: Entry = {
          date: '2024-02-01',
          symbols: 500,
          deleted: 1500,
          projectId: 'project1'
        }

        await saveEntry(entry)
        const entries = await getEntries()

        const saved = entries.find(e => e.date === '2024-02-01')
        expect(saved?.deleted).toBe(1500)
        expect(saved?.symbols).toBe(500)
      })

      it('должен прибавлять символы к существующей записи за сегодня', async () => {
        const today = new Date().toISOString().split('T')[0]
        
        // Первая запись
        const firstEntry: Entry = {
          date: today,
          symbols: 300,
          projectId: 'project1'
        }
        await saveEntry(firstEntry)

        // Получаем сохранённую запись
        let entries = await getEntries()
        const savedEntry = entries.find(e => e.date === today && e.projectId === 'project1')
        expect(savedEntry).toBeDefined()

        // Вторая запись за тот же день и проект (обновляем существующую)
        if (savedEntry) {
          await saveEntry({
            ...savedEntry,
            symbols: savedEntry.symbols + 200
          })
        }

        entries = await getEntries()
        const todayEntry = entries.find(e => e.date === today && e.projectId === 'project1')
        
        expect(todayEntry).toBeDefined()
        expect(todayEntry?.symbols).toBe(500) // 300 + 200
      })

      it('должен создавать отдельные записи для разных проектов в один день', async () => {
        const today = new Date().toISOString().split('T')[0]
        
        await saveEntry({ date: today, symbols: 300, projectId: 'project1' })
        await saveEntry({ date: today, symbols: 200, projectId: 'project2' })

        const entries = await getEntries()
        const project1Entry = entries.find(e => e.projectId === 'project1')
        const project2Entry = entries.find(e => e.projectId === 'project2')
        
        expect(project1Entry?.symbols).toBe(300)
        expect(project2Entry?.symbols).toBe(200)
      })

      it('должен удалять запись по ID', async () => {
        const entry: Entry = {
          date: '2024-01-26',
          symbols: 500
        }

        await saveEntry(entry)
        const entries = await getEntries()
        const savedEntry = entries[0]
        
        await deleteEntry(savedEntry.id!)
        const entriesAfterDelete = await getEntries()
        
        expect(entriesAfterDelete).toHaveLength(0)
      })
    })

    describe('Projects', () => {
      it('должен возвращать пустой массив при отсутствии проектов', async () => {
        const projects = await getProjects()
        expect(projects).toEqual([])
      })

      it('должен сохранять новый проект', async () => {
        const project: Project = {
          id: 'project1',
          title: 'Тестовый проект',
          genre: 'Фэнтези',
          targetSymbols: 100000,
          deadline: '2024-12-31',
          status: 'active',
          startDate: '2024-01-01'
        }

        await saveProject(project)
        const projects = await getProjects()
        
        expect(projects).toHaveLength(1)
        expect(projects[0].title).toBe('Тестовый проект')
        expect(projects[0].targetSymbols).toBe(100000)
      })

      it('должен сохранять фазу проекта (редактура)', async () => {
        const project: Project = {
          id: 'projRev',
          title: 'Роман в редактуре',
          genre: 'fantasy',
          targetSymbols: 100000,
          deadline: '2024-12-31',
          status: 'active',
          phase: 'revision',
          startDate: '2024-01-01'
        }

        await saveProject(project)
        const projects = await getProjects()

        expect(projects.find(p => p.id === 'projRev')?.phase).toBe('revision')
      })

      it('должен обновлять существующий проект', async () => {
        const project: Project = {
          id: 'project1',
          title: 'Тестовый проект',
          genre: 'Фэнтези',
          targetSymbols: 100000,
          deadline: '2024-12-31',
          status: 'active',
          startDate: '2024-01-01'
        }

        await saveProject(project)
        
        const updatedProject: Project = {
          ...project,
          title: 'Обновлённый проект',
          targetSymbols: 150000
        }

        await saveProject(updatedProject)
        const projects = await getProjects()
        
        expect(projects).toHaveLength(1)
        expect(projects[0].title).toBe('Обновлённый проект')
        expect(projects[0].targetSymbols).toBe(150000)
      })

      it('должен удалять проект по ID', async () => {
        const project: Project = {
          id: 'project1',
          title: 'Тестовый проект',
          genre: 'Фэнтези',
          targetSymbols: 100000,
          deadline: '2024-12-31',
          status: 'active',
          startDate: '2024-01-01'
        }

        await saveProject(project)
        await deleteProject('project1')
        
        const projects = await getProjects()
        expect(projects).toHaveLength(0)
      })
    })

    describe('Chapters', () => {
      it('должен сохранять, фильтровать по проекту и удалять главы', async () => {
        await saveChapter({ id: 'c1', projectId: 'p1', title: 'Глава 1', status: 'done', position: 1 })
        await saveChapter({ id: 'c2', projectId: 'p1', title: 'Глава 2', status: 'planned', position: 2 })
        await saveChapter({ id: 'c3', projectId: 'p2', title: 'Чужая глава', status: 'draft', position: 1 })

        const p1Chapters = await getChapters('p1')
        expect(p1Chapters).toHaveLength(2)
        expect(p1Chapters[0].title).toBe('Глава 1')
        expect(p1Chapters[0].status).toBe('done')

        await deleteChapter('c1')
        const after = await getChapters('p1')
        expect(after).toHaveLength(1)
        expect(after[0].id).toBe('c2')
      })
    })

    describe('Sessions', () => {
      it('должен сохранять новую сессию', async () => {
        const session: Session = {
          id: 'session1',
          date: new Date().toISOString(),
          duration: 25,
          plannedDuration: 25,
          symbols: 500,
          speed: 20,
          mood: 'flow'
        }

        await saveSession(session)
        const sessions = await getSessions()
        
        expect(sessions).toHaveLength(1)
        expect(sessions[0].symbols).toBe(500)
        expect(sessions[0].speed).toBe(20)
      })
    })

    describe('Notes', () => {
      it('должен сохранять новую заметку', async () => {
        const note: Note = {
          id: 'note1',
          title: 'Тестовая заметка',
          content: 'Содержимое заметки',
          date: new Date().toISOString()
        }

        await saveNote(note)
        const notes = await getNotes()
        
        expect(notes).toHaveLength(1)
        expect(notes[0].title).toBe('Тестовая заметка')
      })

      it('должен удалять заметку по ID', async () => {
        const note: Note = {
          id: 'note1',
          title: 'Тестовая заметка',
          content: 'Содержимое',
          date: new Date().toISOString()
        }

        await saveNote(note)
        await deleteNote('note1')
        
        const notes = await getNotes()
        expect(notes).toHaveLength(0)
      })
    })

    describe('Settings', () => {
      it('должен сохранять и получать настройки', async () => {
        await setSetting('theme', 'dark')
        const theme = await getSetting('theme')
        
        expect(theme).toBe('dark')
      })

      it('должен возвращать null для несуществующей настройки', async () => {
        const value = await getSetting('nonexistent')
        expect(value).toBeNull()
      })
    })

    describe('Backup', () => {
      it('должен создавать JSON файл в браузере', async () => {
        // Создаём тестовые данные
        await saveEntry({ date: '2024-01-26', symbols: 500 })
        await saveProject({
          id: 'p1',
          title: 'Test',
          genre: 'Фэнтези',
          targetSymbols: 100000,
          deadline: '2024-12-31',
          status: 'active',
          startDate: '2024-01-01'
        })

        // Мокаем создание файла
        const createElementSpy = vi.spyOn(document, 'createElement')
        const clickSpy = vi.fn()
        
        createElementSpy.mockReturnValue({
          href: '',
          download: '',
          click: clickSpy,
          appendChild: vi.fn(),
          removeChild: vi.fn()
        } as any)

        const result = await createBackup()
        
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Electron режим', () => {
    // isElectron фиксируется при загрузке модуля → ставим мок ДО импорта и берём свежий модуль
    beforeEach(() => {
      vi.resetModules()
      setupElectronMock()
    })

    it('должен читать записи через electronAPI (SQLite), включая поле deleted', async () => {
      mockElectronAPI.dbQuery.mockResolvedValue([
        { id: 1, date: '2024-01-01', symbols: 100, deleted: 20, projectId: 'p1' }
      ])
      const db = await import('../databaseService')
      const entries = await db.getEntries()

      expect(mockElectronAPI.dbQuery).toHaveBeenCalledWith(expect.stringContaining('FROM entries'))
      expect(entries).toHaveLength(1)
      expect(entries[0].symbols).toBe(100)
      expect(entries[0].deleted).toBe(20)
    })

    it('должен сохранять запись через electronAPI (INSERT с deleted и syncId)', async () => {
      mockElectronAPI.dbExec.mockResolvedValue({})
      const db = await import('../databaseService')
      await db.saveEntry({ date: '2024-02-01', symbols: 500, deleted: 1500, projectId: 'p1' })

      expect(mockElectronAPI.dbExec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entries'),
        // syncId генерируется при создании — стабильный id для синхронизации
        ['2024-02-01', 500, 1500, 'p1', expect.stringMatching(/^[0-9a-f-]{36}$/)]
      )
    })

    it('должен сохранять проект с phase через electronAPI', async () => {
      mockElectronAPI.dbExec.mockResolvedValue({})
      const db = await import('../databaseService')
      await db.saveProject({
        id: 'p2', title: 'Роман', genre: 'fantasy', targetSymbols: 100000,
        deadline: '2024-12-31', status: 'active', phase: 'revision', startDate: '2024-01-01'
      })

      const call = mockElectronAPI.dbExec.mock.calls.find(c => String(c[0]).includes('INTO projects'))
      expect(call).toBeDefined()
      expect(call?.[1]).toContain('revision') // phase передаётся в параметрах
    })

    it('должен сохранять сессию с тегами и projectId через electronAPI', async () => {
      mockElectronAPI.dbExec.mockResolvedValue({})
      const db = await import('../databaseService')
      await db.saveSession({
        id: 's1', date: '2024-02-01T10:00:00Z', duration: 25, plannedDuration: 25,
        symbols: 800, speed: 32, tags: ['#впотоке', '#утро'], note: 'хорошо пошло', projectId: 'p1'
      })

      const call = mockElectronAPI.dbExec.mock.calls.find(c => String(c[0]).includes('INTO sessions'))
      expect(call).toBeDefined()
      expect(String(call?.[0])).toContain('tags')
      expect(String(call?.[0])).toContain('projectId')
      expect(call?.[1]).toContain(JSON.stringify(['#впотоке', '#утро']))
      expect(call?.[1]).toContain('p1')
    })

    it('должен читать сессии с тегами и projectId из SQLite', async () => {
      mockElectronAPI.dbQuery.mockResolvedValue([
        {
          id: 's1', date: '2024-02-01T10:00:00Z', duration: 25, plannedDuration: 25,
          symbols: 800, speed: 32, mood: null, tags: '["#впотоке","#утро"]', note: null, projectId: 'p1'
        },
        {
          id: 's2', date: '2024-02-02T10:00:00Z', duration: 25, plannedDuration: 25,
          symbols: 100, speed: 4, mood: 'flow', tags: null, note: null, projectId: null
        }
      ])
      const db = await import('../databaseService')
      const sessions = await db.getSessions()

      expect(sessions[0].tags).toEqual(['#впотоке', '#утро'])
      expect(sessions[0].projectId).toBe('p1')
      // старые сессии: tags нет, mood остаётся для обратной совместимости
      expect(sessions[1].tags).toBeUndefined()
      expect(sessions[1].mood).toBe('flow')
      expect(sessions[1].projectId).toBeUndefined()
    })
  })
})
