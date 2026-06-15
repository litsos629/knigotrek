import { describe, it, expect } from 'vitest'
import {
  moodOptions,
  genres,
  projectStatuses,
  getMoodById,
  getMoodLabel,
  getGenreById,
  getGenreLabel,
  getGenreHint
} from '../appConfig'

describe('appConfig', () => {
  describe('moodOptions', () => {
    it('должен содержать все настроения', () => {
      expect(moodOptions.length).toBeGreaterThan(0)
      expect(moodOptions.every(m => m.id && m.emoji && m.label)).toBe(true)
    })

    it('должен содержать уникальные ID', () => {
      const ids = moodOptions.map(m => m.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('должен содержать основные настроения', () => {
      const ids = moodOptions.map(m => m.id)
      expect(ids).toContain('flow')
      expect(ids).toContain('music')
      expect(ids).toContain('coffee')
      expect(ids).toContain('tired')
    })
  })

  describe('genres', () => {
    it('должен содержать все жанры', () => {
      expect(genres.length).toBeGreaterThan(0)
      expect(genres.every(g => g.id && g.label)).toBe(true)
    })

    it('должен содержать уникальные ID', () => {
      const ids = genres.map(g => g.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('должен содержать основные жанры', () => {
      const ids = genres.map(g => g.id)
      expect(ids).toContain('fantasy')
      expect(ids).toContain('romance')
      expect(ids).toContain('detective')
      expect(ids).toContain('other')
    })
  })

  describe('projectStatuses', () => {
    it('должен содержать все статусы', () => {
      expect(projectStatuses.active).toBe('active')
      expect(projectStatuses.completed).toBe('completed')
      expect(projectStatuses.paused).toBe('paused')
    })
  })

  describe('getMoodById', () => {
    it('должен возвращать настроение по ID', () => {
      const mood = getMoodById('flow')
      expect(mood).toBeDefined()
      expect(mood?.id).toBe('flow')
      expect(mood?.label).toBe('В потоке')
    })

    it('должен возвращать undefined для несуществующего ID', () => {
      const mood = getMoodById('nonexistent')
      expect(mood).toBeUndefined()
    })
  })

  describe('getMoodLabel', () => {
    it('должен возвращать метку с emoji', () => {
      const label = getMoodLabel('flow')
      expect(label).toContain('🎯')
      expect(label).toContain('В потоке')
    })

    it('должен возвращать ID для несуществующего настроения', () => {
      const label = getMoodLabel('nonexistent')
      expect(label).toBe('nonexistent')
    })
  })

  describe('getGenreById', () => {
    it('должен возвращать жанр по ID', () => {
      const genre = getGenreById('fantasy')
      expect(genre).toBeDefined()
      expect(genre?.id).toBe('fantasy')
      expect(genre?.label).toBe('Фэнтези')
    })

    it('должен возвращать undefined для несуществующего ID', () => {
      const genre = getGenreById('nonexistent')
      expect(genre).toBeUndefined()
    })
  })

  describe('getGenreLabel', () => {
    it('должен возвращать метку жанра по ID', () => {
      const label = getGenreLabel('fantasy')
      expect(label).toBe('Фэнтези')
    })

    it('должен поддерживать старый формат (строка)', () => {
      const label = getGenreLabel('Фэнтези')
      expect(label).toBe('Фэнтези')
    })

    it('должен возвращать исходное значение для несуществующего жанра', () => {
      const label = getGenreLabel('nonexistent')
      expect(label).toBe('nonexistent')
    })
  })

  describe('getGenreHint', () => {
    it('должен возвращать подсказку для существующего жанра', () => {
      const hint = getGenreHint('fantasy')
      expect(hint).toBeDefined()
      expect(hint).toContain('Фэнтези')
    })

    it('должен поддерживать старый формат (строка)', () => {
      const hint = getGenreHint('Фэнтези')
      expect(hint).toBeDefined()
    })

    it('должен возвращать null для жанра без подсказки', () => {
      const hint = getGenreHint('nonexistent')
      expect(hint).toBeNull()
    })

    it('должен возвращать подсказки для всех основных жанров', () => {
      const genresWithHints = ['fantasy', 'romance', 'detective', 'thriller', 'scifi', 'historical', 'nonfiction', 'fanfic', 'story', 'poetry']
      genresWithHints.forEach(genreId => {
        const hint = getGenreHint(genreId)
        expect(hint).toBeDefined()
        expect(hint).not.toBeNull()
      })
    })
  })
})
