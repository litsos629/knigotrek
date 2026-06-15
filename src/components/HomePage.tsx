import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { format, subDays, differenceInCalendarDays } from 'date-fns'
import { dfnsLocale, formatNumber } from '../i18n/dateLocale'
import AssistantCard from './AssistantCard'
import CalendarHeatmap from './CalendarHeatmap'
import RecordsCard from './RecordsCard'
import AchievementsCard from './AchievementsCard'
// ForecastCard объединен с AssistantCard
import ShareProgressButton from './ShareProgressButton'
import { getEntries, saveEntry, getProjects, getSessions, type Entry } from '../services/databaseService'
import type { WriterPassportData } from '../services/reports/writerPassport'
import { downloadDataUrl, calculateCurrentStreak, calculateLongestStreak, calculateAchievements } from '../services/reports/reportUtils'
import type { ThemeId } from '../services/reports/reportThemes'
import { todayLocal } from '../utils/dates'

interface HomePageProps {
  selectedProjectId: string
  setSelectedProjectId: (id: string) => void
}

function HomePage({ selectedProjectId, setSelectedProjectId }: HomePageProps) {
  const { t } = useTranslation()
  const [symbols, setSymbols] = useState('')
  const [deleted, setDeleted] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [sessions, setSessions] = useState<Array<{ date: string; duration: number; symbols: number; speed: number }>>([])
  const [projects, setProjects] = useState<Array<{id: string, title: string, status: string, targetSymbols?: number, deadline?: string, phase?: 'draft' | 'revision'}>>([])

  // Writer's Passport
  const [showPassportModal, setShowPassportModal] = useState(false)
  const [passportGenerating, setPassportGenerating] = useState(false)
  const [passportTheme, setPassportTheme] = useState<ThemeId>('clean')

  // Текущий проект и режим редактуры
  const currentProject = projects.find(p => p.id === selectedProjectId)
  const isRevision = currentProject?.phase === 'revision'
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayEntry = entries.find(e => e.date === todayStr && e.projectId === (selectedProjectId !== 'all' ? selectedProjectId : undefined))
  const todayWritten = todayEntry?.symbols || 0
  const todayDeleted = todayEntry?.deleted || 0

  const handleGeneratePassport = async (outputFormat: 'pdf' | 'image') => {
    setPassportGenerating(true)
    try {
      const allEntries = await getEntries()
      const allSessions = await getSessions()
      const allProjects = await getProjects()

      const totalSymbols = allEntries.reduce((s, e) => s + e.symbols, 0)
      const activeDays = new Set(allEntries.map(e => e.date)).size
      const entryData = allEntries.map(e => ({ date: e.date, symbols: e.symbols }))

      const passportData: WriterPassportData = {
        authorName: t('home:passport.authorName'),
        registrationDate: allEntries.length > 0
          ? allEntries.reduce((min, e) => e.date < min ? e.date : min, allEntries[0].date)
          : todayLocal(),
        totalSymbols,
        totalSessions: allSessions.length,
        activeDays,
        currentStreak: calculateCurrentStreak(entryData),
        longestStreak: calculateLongestStreak(entryData),
        projects: allProjects.map(p => {
          const projSymbols = allEntries.filter(e => e.projectId === p.id).reduce((s, e) => s + e.symbols, 0)
          return {
            title: p.title,
            symbols: projSymbols,
            targetSymbols: p.targetSymbols || 0,
            completed: p.status === 'completed',
          }
        }),
        achievements: calculateAchievements(totalSymbols, allEntries.length, calculateCurrentStreak(entryData), allProjects.filter(p => p.status === 'completed').length).filter(a => a.unlocked).map(a => ({ emoji: a.emoji, title: a.title })),
      }

      // Генераторы тяжёлые (jspdf+шрифты) — грузим только при использовании
      const passport = await import('../services/reports/writerPassport')
      if (outputFormat === 'pdf') {
        const doc = await passport.generateWriterPassportPDF(passportData, passportTheme)
        doc.save('writer-passport.pdf')
      } else {
        const dataUrl = await passport.generateWriterPassportImage(passportData, passportTheme)
        downloadDataUrl(dataUrl, 'writer-passport.png')
      }
    } catch (err) {
      console.error('Error generating passport:', err)
    } finally {
      setPassportGenerating(false)
    }
  }

  // Загружаем данные из БД при старте
  useEffect(() => {
    loadEntries()
    loadSessions()
    loadProjects()
  }, [])

  const loadEntries = async () => {
    const data = await getEntries()
    setEntries(data)
  }

  const loadSessions = async () => {
    const data = await getSessions()
    setSessions(data.map(s => ({
      date: s.date,
      duration: s.duration,
      symbols: s.symbols,
      speed: s.speed
    })))
  }

  const loadProjects = async () => {
    const data = await getProjects()
    setProjects(data)
  }

  const handleSave = async () => {
    const num = parseInt(symbols)
    if (!isNaN(num) && num >= 0) {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      // Определяем projectId (если выбран конкретный проект и он активен)
      const projectId = selectedProjectId !== 'all' ? selectedProjectId : undefined

      // Удалённые символы — только в режиме редактуры
      const delNum = parseInt(deleted)
      const delValue = isRevision && !isNaN(delNum) && delNum > 0 ? delNum : 0

      // Проверяем, есть ли уже запись за сегодня С ТЕМ ЖЕ projectId
      const existingEntry = entries.find(e =>
        e.date === today && e.projectId === projectId
      )

      if (existingEntry) {
        // ПРИБАВЛЯЕМ к существующей записи
        const updatedEntry: Entry = {
          ...existingEntry,
          symbols: existingEntry.symbols + num,
          deleted: (existingEntry.deleted || 0) + delValue
        }
        await saveEntry(updatedEntry)
      } else {
        // Добавляем новую запись
        const newEntry: Entry = {
          date: today,
          symbols: num,
          deleted: delValue,
          projectId
        }
        await saveEntry(newEntry)
      }

      // Перезагружаем данные
      await loadEntries()
      setSymbols('') // Очищаем поле
      setDeleted('')
    }
  }

  // Фильтруем записи по выбранному проекту
  const getFilteredEntries = () => {
    if (selectedProjectId === 'all') {
      return entries // Все записи
    }
    return entries.filter(e => e.projectId === selectedProjectId)
  }

  const filteredEntries = getFilteredEntries()

  // Считаем общий прогресс (для выбранного проекта или всех)
  const totalSymbols = filteredEntries.reduce((sum, entry) => sum + entry.symbols, 0)

  // Считаем streak (дни подряд) - только для выбранного проекта
  const calculateStreak = () => {
    if (filteredEntries.length === 0) return 0
    const sortedDates = filteredEntries
      .map(e => e.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    let streak = 0
    const today = format(new Date(), 'yyyy-MM-dd')
    
    // Проверяем, писал ли сегодня или вчера
    const lastDate = sortedDates[0]
    const daysDiff = differenceInCalendarDays(new Date(today), new Date(lastDate))
    if (daysDiff > 1) return 0 // Streak сломан

    // Считаем последовательные дни
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const current = new Date(sortedDates[i])
      const next = new Date(sortedDates[i + 1])
      const diff = differenceInCalendarDays(current, next)
      if (diff === 1) {
        streak++
      } else {
        break
      }
    }
    return streak + 1 // +1 за первый день
  }

  const streak = calculateStreak()

  // Получаем данные за последние 7 дней для графика
  const getLast7Days = () => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const entry = filteredEntries.find(e => e.date === date)
      days.push({
        date: date,
        dateFormatted: format(subDays(new Date(), i), 'd MMM', { locale: dfnsLocale() }),
        symbols: entry ? entry.symbols : 0
      })
    }
    return days
  }

  const last7Days = getLast7Days()
  const maxSymbols = Math.max(...last7Days.map(d => d.symbols), 1)
  const last7DaysSymbols = last7Days.reduce((sum, day) => sum + day.symbols, 0)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Статистика */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            {t('home:title')}
          </h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-indigo-50 p-4 rounded-lg">
            <p className="text-sm text-indigo-600 font-medium">{t('home:stats.totalSymbols')}</p>
            <p className="text-3xl font-bold text-indigo-700">{formatNumber(totalSymbols)}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-medium">{t('home:stats.entries')}</p>
            <p className="text-3xl font-bold text-green-700">{filteredEntries.length}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-medium">{t('home:stats.streak')}</p>
            <p className="text-3xl font-bold text-orange-700">🔥 {streak}</p>
          </div>
        </div>
      </div>

      {/* Выбор проекта */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('home:projectSelect.label')}
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
        >
          <option value="all">📊 {t('home:projectSelect.all')}</option>
          {projects
            .filter(p => p.status === 'active')
            .map(project => (
              <option key={project.id} value={project.id}>
                📚 {project.title}
              </option>
            ))
          }
        </select>
        {selectedProjectId !== 'all' && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t('home:projectSelect.hint')}
          </p>
        )}
      </div>

      {/* Форма ввода */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          {t('home:input.title')}
          <HelpTip text={t('common:help.progress')} />
        </h2>
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[140px]">
            {isRevision && (
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">{t('home:input.writtenLabel')}</label>
            )}
            <input
              type="number"
              min="0"
              value={symbols}
              onChange={(e) => setSymbols(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('home:input.placeholder')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            />
          </div>
          {isRevision && (
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">{t('home:input.deletedLabel')}</label>
              <input
                type="number"
                min="0"
                value={deleted}
                onChange={(e) => setDeleted(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder={t('home:input.deletedPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            {t('actions.save')}
          </button>
        </div>
        {isRevision && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-lg px-3 py-2">
            ✂️ {t('home:input.revisionHint')}
            {(todayWritten > 0 || todayDeleted > 0) && (
              <span className="block mt-1 font-medium text-gray-800 dark:text-gray-100">
                {t('home:input.revisionToday', { written: formatNumber(todayWritten), deleted: formatNumber(todayDeleted), net: (todayWritten - todayDeleted >= 0 ? '+' : '') + formatNumber((todayWritten - todayDeleted)) })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Умный ассистент (прогноз + план + советы + аналитика) */}
      <div className="mb-6">
        <AssistantCard
          totalSymbols={totalSymbols}
          entriesCount={filteredEntries.length}
          streak={streak}
          last7DaysSymbols={last7DaysSymbols}
          selectedProjectId={selectedProjectId}
        />
      </div>

      {/* Ачивки */}
      <AchievementsCard
        totalSymbols={totalSymbols}
        entriesCount={filteredEntries.length}
        streak={streak}
        completedProjects={projects.filter(p => p.status === 'completed').length}
      />

      {/* Паспорт писателя */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {t('home:passport.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('home:passport.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowPassportModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            {t('home:passport.create')}
          </button>
        </div>
      </div>

      {/* Модалка паспорта писателя */}
      {showPassportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('home:passport.title')}</h3>
                <button onClick={() => setShowPassportModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl">&times;</button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('home:passport.themeLabel')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPassportTheme('clean')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition border-2 ${
                      passportTheme === 'clean' ? 'border-indigo-500' : 'border-transparent'
                    } bg-gray-100 text-gray-800`}
                  >
                    {t('home:passport.themeClean')}
                  </button>
                  <button
                    onClick={() => setPassportTheme('dark')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition border-2 ${
                      passportTheme === 'dark' ? 'border-indigo-500' : 'border-transparent'
                    } bg-gray-900 text-cyan-400`}
                  >
                    {t('home:passport.themeDark')}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGeneratePassport('pdf')}
                  disabled={passportGenerating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {passportGenerating ? t('home:passport.generating') : t('home:passport.downloadPdf')}
                </button>
                <button
                  onClick={() => handleGeneratePassport('image')}
                  disabled={passportGenerating}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {passportGenerating ? t('home:passport.generating') : t('home:passport.downloadImage')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Поделиться прогрессом */}
      <ShareProgressButton
        entries={filteredEntries}
        sessions={sessions}
        streak={streak}
        totalSymbols={totalSymbols}
        projectTitle={selectedProjectId !== 'all' ? projects.find(p => p.id === selectedProjectId)?.title : undefined}
      />

      {/* График за последние 7 дней */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          {t('home:chart.title')}
        </h2>
        
        {/* Горизонтальный график с кривой */}
        <div className="relative w-full" style={{ height: '200px' }}>
          <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="none" className="overflow-visible">
            {/* Сетка и подписи */}
            {last7Days.map((day, index) => {
              const x = 50 + (index / (last7Days.length - 1)) * 700
              return (
                <g key={index}>
                  {/* Вертикальная линия сетки */}
                  <line
                    x1={x}
                    y1="10"
                    x2={x}
                    y2="150"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-gray-300 dark:text-gray-600 opacity-30"
                  />
                  {/* Подпись даты */}
                  <text
                    x={x}
                    y="175"
                    textAnchor="middle"
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                  >
                    {day.dateFormatted}
                  </text>
                  {/* Значение */}
                  <text
                    x={x}
                    y="5"
                    textAnchor="middle"
                    className="text-xs font-medium fill-gray-800 dark:fill-gray-200"
                  >
                    {day.symbols}
                  </text>
                </g>
              )
            })}
            
            {/* Область под кривой (градиент) */}
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path
              d={`M 50,150 L ${last7Days.map((day, index) => {
                const x = 50 + (index / (last7Days.length - 1)) * 700
                const y = 150 - (day.symbols / maxSymbols) * 130
                return `${x},${y}`
              }).join(' L ')} L 750,150 Z`}
              fill="url(#areaGradient)"
            />
            
            {/* Кривая линия */}
            <path
              d={`M ${last7Days.map((day, index) => {
                const x = 50 + (index / (last7Days.length - 1)) * 700
                const y = 150 - (day.symbols / maxSymbols) * 130
                return `${x},${y}`
              }).join(' L ')}`}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-sm"
            />
            
            {/* Точки на кривой */}
            {last7Days.map((day, index) => {
              const x = 50 + (index / (last7Days.length - 1)) * 700
              const y = 150 - (day.symbols / maxSymbols) * 130
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="5"
                  fill="#4f46e5"
                  className="drop-shadow-sm"
                />
              )
            })}
          </svg>
        </div>
        
        {/* Легенда под графиком */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('home:chart.legend')}</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-500">
            {t('home:chart.max', { value: formatNumber(maxSymbols) })}
          </span>
        </div>
      </div>

      {/* Календарь-хитмап */}
      <CalendarHeatmap entries={filteredEntries} />

      {/* Персональные рекорды */}
      <RecordsCard entries={filteredEntries} currentStreak={streak} />

      {/* История записей */}
      {filteredEntries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            {t('home:history.title', { count: filteredEntries.length })}
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredEntries.map((entry, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">
                  {format(new Date(entry.date), 'd MMMM yyyy', { locale: dfnsLocale() })}
                </span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{t('home:history.symbols', { value: formatNumber(entry.symbols) })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage