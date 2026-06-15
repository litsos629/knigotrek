/**
 * Централизованная конфигурация приложения
 * Single Source of Truth для всех констант
 */
import i18n from '../i18n'

/** Перевод строки из namespace `config`. */
const tc = (key: string, opts?: Record<string, unknown>): string =>
  i18n.t(key, { ns: 'config', ...opts }) as string

export interface MoodOption {
  id: string
  emoji: string
  label: string
}

export interface GenreOption {
  id: string
  label: string
}

/**
 * Настроения/статусы для сессий фокуса
 */
export const moodOptions: MoodOption[] = [
  { id: 'flow', emoji: '🎯', label: 'В потоке' },
  { id: 'music', emoji: '🎵', label: 'Под музыку' },
  { id: 'coffee', emoji: '☕', label: 'С кофе' },
  { id: 'walk', emoji: '🚶', label: 'После прогулки' },
  { id: 'good', emoji: '😊', label: 'Хорошо' },
  { id: 'normal', emoji: '😐', label: 'Нормально' },
  { id: 'tired', emoji: '😴', label: 'Устал' },
  { id: 'distracted', emoji: '📱', label: 'Отвлекался' },
  { id: 'noIdeas', emoji: '🤔', label: 'Нет идей' }
]

/**
 * Жанры проектов
 */
export const genres: GenreOption[] = [
  { id: 'fantasy', label: 'Фэнтези' },
  { id: 'romance', label: 'Романтика' },
  { id: 'detective', label: 'Детектив' },
  { id: 'thriller', label: 'Триллер' },
  { id: 'scifi', label: 'Научная фантастика' },
  { id: 'historical', label: 'Историческая проза' },
  { id: 'nonfiction', label: 'Non-fiction' },
  { id: 'fanfic', label: 'Фанфик' },
  { id: 'story', label: 'Рассказ' },
  { id: 'poetry', label: 'Поэзия' },
  { id: 'other', label: 'Другое' }
]

/**
 * Статусы проектов
 */
export const projectStatuses = {
  active: 'active',
  completed: 'completed',
  paused: 'paused'
} as const

export type ProjectStatus = typeof projectStatuses[keyof typeof projectStatuses]

/**
 * Получить настроение по ID
 */
export function getMoodById(moodId: string): MoodOption | undefined {
  return moodOptions.find(m => m.id === moodId)
}

/**
 * Получить метку настроения для отображения (с emoji)
 */
export function getMoodLabel(moodId: string): string {
  const mood = getMoodById(moodId)
  return mood ? `${mood.emoji} ${tc(`moods.${mood.id}`)}` : moodId
}

/**
 * Предустановленные теги-подсказки для быстрого старта.
 * Это данные (хранятся в сессиях как есть), поэтому наборы раздельные по языку,
 * а не через i18n: смена языка не должна «переводить» уже сохранённые теги.
 */
const tagSuggestionsByLang: Record<'ru' | 'en', string[]> = {
  ru: [
    '#впотоке', '#подмузыку', '#скофе', '#послепрогулки',
    '#хорошо', '#нормально', '#устал', '#отвлекался', '#нетидей',
    '#утро', '#вечер', '#ночь', '#дедлайн', '#вдохновение',
    '#тихо', '#шумно', '#помедитировал', '#после_спорта'
  ],
  en: [
    '#flow', '#withmusic', '#coffee', '#afterwalk',
    '#good', '#okay', '#tired', '#distracted', '#noideas',
    '#morning', '#evening', '#night', '#deadline', '#inspired',
    '#quiet', '#noisy', '#meditated', '#after_workout'
  ]
}

/** Теги-подсказки под текущий язык приложения. */
export function getDefaultTagSuggestions(): string[] {
  return tagSuggestionsByLang[i18n.language === 'en' ? 'en' : 'ru']
}

/**
 * Маппинг старых mood ID → тег (для обратной совместимости)
 */
const moodToTagMap: Record<string, string> = {
  flow: '#впотоке',
  music: '#подмузыку',
  coffee: '#скофе',
  walk: '#послепрогулки',
  good: '#хорошо',
  normal: '#нормально',
  tired: '#устал',
  distracted: '#отвлекался',
  noIdeas: '#нетидей',
}

/**
 * Конвертировать старое настроение в тег
 */
export function moodToTag(moodId: string): string {
  return moodToTagMap[moodId] || `#${moodId}`
}

/**
 * Получить теги сессии, с конвертацией старого mood
 */
export function getSessionTags(session: { tags?: string[]; mood?: string }): string[] {
  if (session.tags && session.tags.length > 0) return session.tags
  if (session.mood) return [moodToTag(session.mood)]
  return []
}

/**
 * Форматировать теги для отображения
 */
export function formatTags(tags: string[]): string {
  return tags.join(' ')
}

/**
 * Получить жанр по ID
 */
export function getGenreById(genreId: string): GenreOption | undefined {
  return genres.find(g => g.id === genreId)
}

/**
 * Получить метку жанра
 */
export function getGenreLabel(genreId: string): string {
  const genre = getGenreById(genreId)
  // Поддержка старого формата (строка) и нового (ID)
  if (!genre) {
    // Пытаемся найти по label (для обратной совместимости)
    const genreByLabel = genres.find(g => g.label === genreId)
    return genreByLabel ? tc(`genres.${genreByLabel.id}`) : genreId
  }
  return tc(`genres.${genre.id}`)
}

/**
 * Получить подсказку по жанру (рекомендуемый объем)
 */
export function getGenreHint(genreId: string): string | null {
  // Резолвим ID: поддержка старого формата (хранилась строка-label)
  let id = genreId
  if (!getGenreById(id)) {
    const genre = genres.find(g => g.label === genreId)
    if (genre) id = genre.id
  }
  const key = `genreHints.${id}`
  const hint = tc(key)
  // i18next возвращает сам ключ, если перевода нет
  return hint === key ? null : hint
}
