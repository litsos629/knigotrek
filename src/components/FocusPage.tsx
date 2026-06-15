import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { format } from 'date-fns'
import { dfnsLocale, formatNumber } from '../i18n/dateLocale'
import { getSessions, saveSession, getProjects, type Session } from '../services/databaseService'
import SessionReportModal from './SessionReportModal'
import { useToast } from './Toast'
import type { SessionData } from '../services/pdfService'
import { getDefaultTagSuggestions, getSessionTags } from '../config/appConfig'

interface FocusPageProps {
  selectedProjectId: string
  setSelectedProjectId: (id: string) => void
  timerDuration: number
  setTimerDuration: (duration: number) => void
  timerTimeLeft: number
  setTimerTimeLeft: (time: number) => void
  timerIsRunning: boolean
  setTimerIsRunning: (running: boolean) => void
  timerStartTime: number | null
  setTimerStartTime: (time: number | null) => void
  timerIsFinished: boolean
  setTimerIsFinished: (finished: boolean) => void
}

function FocusPage({
  selectedProjectId,
  setSelectedProjectId,
  timerDuration,
  setTimerDuration,
  timerTimeLeft,
  setTimerTimeLeft,
  timerIsRunning,
  setTimerIsRunning,
  timerStartTime,
  setTimerStartTime,
  timerIsFinished,
  setTimerIsFinished
}: FocusPageProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const sessionFormRef = useRef<HTMLDivElement>(null)
  const durations = [15, 25, 45, 60]
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')

  // Форма после завершения
  const [symbolsInput, setSymbolsInput] = useState('')
  const [sessionTags, setSessionTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  
  // История сессий
  const [sessions, setSessions] = useState<Session[]>([])
  const [projects, setProjects] = useState<Array<{id: string, title: string, status: string}>>([])
  
  // Модалка микроотчета
  const [showReportModal, setShowReportModal] = useState(false)
  const [lastSavedSession, setLastSavedSession] = useState<SessionData | null>(null)
  
  // Загружаем сессии из БД
  useEffect(() => {
    loadSessions()
    loadProjects()
  }, [])

  // Черновик формы сессии: FocusPage размонтируется при смене страницы,
  // и без черновика введённые символы/теги/заметка терялись бы
  const DRAFT_KEY = 'knigotrek_session_draft'
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.symbolsInput) setSymbolsInput(draft.symbolsInput)
        if (Array.isArray(draft.sessionTags) && draft.sessionTags.length > 0) setSessionTags(draft.sessionTags)
        if (draft.noteInput) setNoteInput(draft.noteInput)
      }
    } catch { /* битый черновик игнорируем */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      if (symbolsInput || sessionTags.length > 0 || noteInput) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ symbolsInput, sessionTags, noteInput }))
      } else {
        localStorage.removeItem(DRAFT_KEY)
      }
    } catch { /* localStorage недоступен */ }
  }, [symbolsInput, sessionTags, noteInput])

  const loadSessions = async () => {
    const data = await getSessions()
    setSessions(data)
  }

  const loadProjects = async () => {
    const data = await getProjects()
    setProjects(data)
  }
  
  // Синхронизируем timerTimeLeft с timerDuration при изменении (только если таймер не запущен)
  useEffect(() => {
    if (!timerIsRunning && !timerStartTime && timerTimeLeft !== timerDuration * 60) {
      // Только если таймер сброшен или не запущен - синхронизируем с новой длительностью
      setTimerTimeLeft(timerDuration * 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerDuration])

  // Прокрутка к форме после завершения таймера
  useEffect(() => {
    if (timerIsFinished && sessionFormRef.current && typeof sessionFormRef.current.scrollIntoView === 'function') {
      sessionFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [timerIsFinished])

  // Старт
  const startTimer = () => {
    if (timerTimeLeft === 0) {
      setTimerTimeLeft(timerDuration * 60)
      setTimerIsFinished(false)
    }
    if (!timerStartTime) {
      setTimerStartTime(Date.now())
    }
    setTimerIsRunning(true)
  }
  
  // Пауза
  const pauseTimer = () => {
    setTimerIsRunning(false)
  }
  
  // Завершить досрочно
  const finishEarly = () => {
    setTimerIsRunning(false)
    setTimerIsFinished(true)
  }
  
  // Сброс
  const resetTimer = () => {
    setTimerIsRunning(false)
    setTimerTimeLeft(timerDuration * 60)
    setTimerIsFinished(false)
    setTimerStartTime(null)
    setSymbolsInput('')
    setSessionTags([])
    setTagInput('')
    setNoteInput('')
  }
  
  // Изменить длительность
  const changeDuration = (minutes: number) => {
    setTimerDuration(minutes)
    setTimerTimeLeft(minutes * 60)
    setTimerIsRunning(false)
    setTimerIsFinished(false)
    setTimerStartTime(null)
  }
  
// Сохранить сессию
const handleSaveSession = async () => {
  const symbols = parseInt(symbolsInput)
  if (isNaN(symbols) || symbols < 0) {
    showToast(t('focus:enterSymbols'), 'warning')
    return
  }
  
  // Фактическое время работы (в минутах)
  const actualDuration = Math.round((timerDuration * 60 - timerTimeLeft) / 60)
  const speed = actualDuration > 0 ? Math.round(symbols / actualDuration) : 0
  
  const newSession: Session = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    duration: actualDuration,
    plannedDuration: timerDuration,
    symbols,
    speed,
    tags: sessionTags.length > 0 ? sessionTags : undefined,
    note: noteInput || undefined,
    projectId: selectedProjectId !== 'all' ? selectedProjectId : undefined
  }
  
  await saveSession(newSession)
  await loadSessions()
  
  // ДОБАВЛЯЕМ СИМВОЛЫ НА ГЛАВНУЮ СТРАНИЦУ
  const today = format(new Date(), 'yyyy-MM-dd')
  const projectId = selectedProjectId !== 'all' ? selectedProjectId : undefined
  
  // Получаем существующие записи
  const { getEntries, saveEntry } = await import('../services/databaseService')
  const entries = await getEntries()
  
  // Проверяем, есть ли уже запись за сегодня С ТЕМ ЖЕ projectId
  const existingEntry = entries.find(e => e.date === today && e.projectId === projectId)
  
  if (existingEntry) {
    // Прибавляем к существующей записи
    await saveEntry({
      ...existingEntry,
      symbols: existingEntry.symbols + symbols
    })
  } else {
    // Создаём новую запись
    await saveEntry({
      date: today,
      symbols,
      projectId
    })
  }
  
  // Подготовка данных для микроотчета
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const sessionDataForReport: SessionData = {
    id: newSession.id,
    date: newSession.date,
    duration: newSession.duration,
    plannedDuration: newSession.plannedDuration,
    symbols: newSession.symbols,
    speed: newSession.speed,
    tags: newSession.tags,
    note: newSession.note,
    projectId: selectedProjectId !== 'all' ? selectedProjectId : undefined,
    projectTitle: selectedProject?.title
  }
  
  setLastSavedSession(sessionDataForReport)
  
  // Сброс
  resetTimer()
  
  // Показываем модалку микроотчета
  setShowReportModal(true)
}
  
  // Форматирование времени
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  // Процент прогресса - используем точный расчет
  const totalSeconds = timerDuration * 60
  const elapsedSeconds = totalSeconds - timerTimeLeft
  const progress = Math.min(Math.max((elapsedSeconds / totalSeconds) * 100, 0), 100)
  
  // Прошло времени
  const elapsedMinutes = Math.round(elapsedSeconds / 60)

  // Теги: добавление
  const addTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase().replace(/\s+/g, '_')
    const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`
    if (withHash.length > 1 && !sessionTags.includes(withHash)) {
      setSessionTags(prev => [...prev, withHash])
    }
    setTagInput('')
    setShowTagSuggestions(false)
  }

  const removeTag = (tag: string) => {
    setSessionTags(prev => prev.filter(t => t !== tag))
  }

  // Собираем теги из истории для автокомплита
  const usedTags = Array.from(new Set(
    sessions.flatMap(s => getSessionTags(s))
  )).sort()

  // Фильтруем подсказки по вводу
  const allSuggestions = Array.from(new Set([...usedTags, ...getDefaultTagSuggestions()]))
  const filteredSuggestions = tagInput.length > 0
    ? allSuggestions.filter(t => t.includes(tagInput.toLowerCase()) && !sessionTags.includes(t))
    : allSuggestions.filter(t => !sessionTags.includes(t)).slice(0, 12)
  
  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          🕐 {t('focus:title')}
          <HelpTip text={t('common:help.focus')} />
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {t('focus:subtitle')}
        </p>
      </div>
      
      {/* Таймер */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-6">
        {/* Выбор длительности */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {durations.map((duration) => (
            <button
              key={duration}
              onClick={() => { changeDuration(duration); setShowCustomInput(false) }}
              disabled={timerIsRunning || timerStartTime !== null}
              className={`px-4 py-2 rounded-lg transition ${
                timerDuration === duration && !showCustomInput
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${timerIsRunning || timerStartTime !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t('focus:minutes', { count: duration })}
            </button>
          ))}
          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              disabled={timerIsRunning || timerStartTime !== null}
              className={`px-4 py-2 rounded-lg transition ${
                !durations.includes(timerDuration) && !showCustomInput
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${timerIsRunning || timerStartTime !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {!durations.includes(timerDuration) ? t('focus:minutes', { count: timerDuration }) : t('focus:custom')}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="480"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const mins = parseInt(customMinutes)
                    if (mins > 0 && mins <= 480) {
                      changeDuration(mins)
                      setShowCustomInput(false)
                    }
                  } else if (e.key === 'Escape') {
                    setShowCustomInput(false)
                  }
                }}
                placeholder={t('focus:minutesPlaceholder')}
                autoFocus
                className="w-20 px-3 py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
              <button
                onClick={() => {
                  const mins = parseInt(customMinutes)
                  if (mins > 0 && mins <= 480) {
                    changeDuration(mins)
                    setShowCustomInput(false)
                  }
                }}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                OK
              </button>
              <button
                onClick={() => setShowCustomInput(false)}
                className="px-2 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        
        {/* Круговой таймер */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-64 h-64 mb-4">
            {/* Круговой прогресс */}
            <svg className="transform -rotate-90 w-64 h-64">
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="#e5e7eb"
                strokeWidth="16"
                fill="none"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="#4f46e5"
                strokeWidth="16"
                fill="none"
                strokeDasharray={2 * Math.PI * 120}
                strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
                style={{
                  transition: 'stroke-dashoffset 0.3s linear'
                }}
              />
            </svg>
            
            {/* Время */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-gray-800 dark:text-white">
                {formatTime(timerTimeLeft)}
              </span>
              {timerStartTime && (
                <span className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {t('focus:elapsed', { count: elapsedMinutes })}
                </span>
              )}
            </div>
          </div>
          
          {/* Кнопки управления */}
          <div className="flex gap-3">
            {!timerIsRunning ? (
              <>
                <button
                  onClick={startTimer}
                  disabled={timerIsFinished}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {timerTimeLeft === timerDuration * 60 ? t('focus:start') : t('focus:resume')}
                </button>
                {timerStartTime && !timerIsFinished && (
                  <button
                    onClick={finishEarly}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-lg font-medium"
                  >
                    {t('focus:finish')}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={pauseTimer}
                  className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-lg font-medium"
                >
                  {t('focus:pause')}
                </button>
                <button
                  onClick={finishEarly}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-lg font-medium"
                >
                  {t('focus:finish')}
                </button>
              </>
            )}
            <button
              onClick={resetTimer}
              className="px-8 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition text-lg font-medium"
            >
              {t('focus:reset')}
            </button>
          </div>
        </div>
        
        {/* Форма после завершения */}
        {timerIsFinished && (
          <div ref={sessionFormRef} className="mt-6 p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-3">
              ✅ {t('focus:sessionComplete')}
            </h3>
            <p className="text-green-700 dark:text-green-400 mb-4">
              {t('focus:workedMinutes', { elapsed: elapsedMinutes, planned: timerDuration })}
            </p>
            
            {/* Выбор проекта */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('focus:whichProject')}
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="all">📊 {t('focus:allProjects')}</option>
                {projects
                  .filter(p => p.status === 'active')
                  .map(project => (
                    <option key={project.id} value={project.id}>
                      📚 {project.title}
                    </option>
                  ))
                }
              </select>
            </div>
            
            {/* Символы */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('focus:symbolsLabel')}
              </label>
              <input
                type="number"
                min="0"
                value={symbolsInput}
                onChange={(e) => setSymbolsInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && symbolsInput && handleSaveSession()}
                placeholder={t('focus:symbolsPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 dark:text-white"
                autoFocus
              />
            </div>
            
            {/* Теги */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('focus:tagsLabel')}
                </label>
                <div className="group relative">
                  <span className="text-gray-400 dark:text-gray-500 cursor-help text-sm">?</span>
                  <div className="absolute left-0 bottom-full mb-1 w-64 p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg text-xs text-gray-600 dark:text-gray-300 hidden group-hover:block z-10">
                    <p className="font-medium mb-1">{t('focus:tagsHintTitle')}</p>
                    <p className="text-gray-500 dark:text-gray-400">{t('focus:tagsHintExamples')}</p>
                    <p className="mt-1">{t('focus:tagsHintDescription')}</p>
                  </div>
                </div>
              </div>

              {/* Выбранные теги */}
              {sessionTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {sessionTags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-200 ml-0.5"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Ввод тега */}
              <div className="relative">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value)
                    setShowTagSuggestions(true)
                  }}
                  onFocus={() => setShowTagSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault()
                      addTag(tagInput)
                    } else if (e.key === 'Backspace' && !tagInput && sessionTags.length > 0) {
                      removeTag(sessionTags[sessionTags.length - 1])
                    } else if (e.key === 'Escape') {
                      setShowTagSuggestions(false)
                    }
                  }}
                  placeholder={sessionTags.length > 0 ? t('focus:tagInputMore') : t('focus:tagInputPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 dark:text-white text-sm"
                />

                {/* Подсказки */}
                {showTagSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-1 p-2">
                      {filteredSuggestions.map(tag => (
                        <button
                          key={tag}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addTag(tag)}
                          className="px-2.5 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-300 transition"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Заметка */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('focus:noteLabel')}
              </label>
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t('focus:notePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 dark:text-white resize-none"
                rows={2}
              />
            </div>
            
            <button
              onClick={handleSaveSession}
              disabled={!symbolsInput}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('focus:saveSession')}
            </button>
          </div>
        )}
      </div>
      
      {/* История сессий */}
      {sessions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            {t('focus:sessionsHistory', { count: sessions.length })}
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sessions.map((session) => {
              const tags = getSessionTags(session)
              return (
                <div
                  key={session.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">
                        {t('focus:symbolsInMinutes', { symbols: formatNumber(session.symbols), duration: session.duration })}
                        {session.duration < session.plannedDuration && (
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                            {t('focus:ofMinutes', { count: session.plannedDuration })}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(session.date), 'd MMMM yyyy, HH:mm', { locale: dfnsLocale() })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('focus:speed')}</p>
                      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {t('focus:speedValue', { speed: session.speed })}
                      </p>
                    </div>
                  </div>

                  {/* Теги и заметка */}
                  {(tags.length > 0 || session.note) && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {session.note && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                          "{session.note}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Модалка микроотчета */}
      {lastSavedSession && (
        <SessionReportModal
          sessionData={lastSavedSession}
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false)
            setLastSavedSession(null)
          }}
        />
      )}
    </div>
  )
}

export default FocusPage