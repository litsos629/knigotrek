import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format, differenceInDays } from 'date-fns'
import { dfnsLocale, formatNumber } from '../i18n/dateLocale'
import { getEntries, getChapters, type Project } from '../services/databaseService'
import { computeForecastCore, type ForecastCore } from '../services/assistantService'
import { useConfirm } from './ConfirmModal'
import MilestoneModal from './MilestoneModal'
import ChaptersModal from './ChaptersModal'
import type { MilestoneData } from '../services/pdfService'
import { getGenreLabel } from '../config/appConfig'

type ForecastMessage = { emoji: string; title: string; message: string }

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (projectId: string) => void
  onComplete: (projectId: string) => void
  onReplan?: (project: Project, newDeadline: string) => void
}

function ProjectCard({ project, onEdit, onDelete, onComplete, onReplan }: ProjectCardProps) {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [progress, setProgress] = useState({ total: 0, percentage: 0 })
  const [forecast, setForecast] = useState<ForecastCore | null>(null)
  const [forecastMessage, setForecastMessage] = useState<ForecastMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null)
  const [showChapters, setShowChapters] = useState(false)
  const [chapterStats, setChapterStats] = useState({ done: 0, total: 0 })
  const [todaySymbols, setTodaySymbols] = useState(0)
  const [neededToday, setNeededToday] = useState(0)

  useEffect(() => {
    loadProjectData()
  }, [project])

  const loadProjectData = async () => {
    setLoading(true)
    try {
      // Загружаем прогресс
      const entries = await getEntries()
      const projectEntries = entries.filter(e => e.projectId === project.id)
      const total = projectEntries.reduce((sum, e) => sum + e.symbols, 0)
      const percentage = Math.min(Math.round((total / project.targetSymbols) * 100), 100)
      const prevPercentage = progress.percentage
      setProgress({ total, percentage })

      // Структурный прогресс по главам
      const chs = await getChapters(project.id)
      setChapterStats({ done: chs.filter(c => c.status === 'done').length, total: chs.length })

      // Адаптивная дневная цель
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const todayProject = projectEntries.filter(e => e.date === todayStr).reduce((s, e) => s + e.symbols, 0)
      setTodaySymbols(todayProject)
      const daysUntilDeadline = differenceInDays(new Date(project.deadline), new Date())
      const remaining = Math.max(project.targetSymbols - total, 0)
      setNeededToday(daysUntilDeadline > 0 ? Math.ceil(remaining / daysUntilDeadline) : 0)

      // Проверка достижения 50% (только один раз)
      if (percentage >= 50 && prevPercentage < 50) {
        const milestoneKey = `milestone-50-${project.id}`
        const hasShown = localStorage.getItem(milestoneKey)
        
        if (!hasShown) {
          // Собираем статистику для отчета
          // Лучший день
          const bestDay = Math.max(...projectEntries.map(e => e.symbols), 0)
          
          // Средний темп
          const today = new Date()
          const startDate = new Date(project.startDate)
          const daysWorked = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const averageSpeed = daysWorked > 0 ? Math.round(total / daysWorked) : 0
          
          // Streak (упрощенный расчет)
          const sortedDates = projectEntries.map(e => e.date).sort()
          let streak = 0
          if (sortedDates.length > 0) {
            const lastDate = new Date(sortedDates[sortedDates.length - 1])
            const todayDate = new Date()
            todayDate.setHours(0, 0, 0, 0)
            lastDate.setHours(0, 0, 0, 0)
            const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
            if (daysDiff <= 1) {
              // Считаем streak (упрощенно)
              streak = 1
              const checkDate = new Date(lastDate)
              for (let i = sortedDates.length - 2; i >= 0; i--) {
                const prevDate = new Date(sortedDates[i])
                prevDate.setHours(0, 0, 0, 0)
                const diff = Math.floor((checkDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
                if (diff === 1) {
                  streak++
                  checkDate.setTime(prevDate.getTime())
                } else {
                  break
                }
              }
            }
          }

          const milestoneDataForReport: MilestoneData = {
            project: {
              id: project.id,
              title: project.title,
              genre: project.genre,
              targetSymbols: project.targetSymbols,
              startDate: project.startDate,
              deadline: project.deadline
            },
            stats: {
              totalSymbols: total,
              targetSymbols: project.targetSymbols,
              progress: percentage,
              daysWorked,
              startDate: project.startDate,
              deadline: project.deadline,
              bestDay,
              averageSpeed,
              streak
            }
          }
          
          setMilestoneData(milestoneDataForReport)
          setShowMilestoneModal(true)
          localStorage.setItem(milestoneKey, 'true')
        }
      }

      // Загружаем прогноз — общее ядро из assistantService (A9: одна реализация)
      const forecastData = computeForecastCore(project, projectEntries)
      setForecast(forecastData)

      const message = getForecastMessage(forecastData, project, total)
      setForecastMessage(message)
    } catch (error) {
      console.error('Error loading project data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Мягкое перепланирование: сдвинуть дедлайн на реалистичную дату (синдром сломанной цепочки)
  const handleReplan = async () => {
    if (!forecast?.projectedFinish) return
    const newDate = forecast.projectedFinish as Date
    const dateLabel = format(newDate, 'd MMMM yyyy', { locale: dfnsLocale() })
    const ok = await confirm({
      title: t('projects:forecast.replanConfirmTitle'),
      message: t('projects:forecast.replanConfirmMessage', { date: dateLabel }),
      confirmText: t('projects:forecast.replanConfirmYes'),
    })
    if (!ok) return
    onReplan?.(project, format(newDate, 'yyyy-MM-dd'))
  }

  const getForecastMessage = (forecast: ForecastCore, project: Project, total: number): ForecastMessage => {
    if (forecast.status === 'nodata') {
      return {
        emoji: '📝',
        title: t('projects:forecast.nodataTitle'),
        message: t('projects:forecast.nodataMessage')
      }
    }

    const remaining = project.targetSymbols - total
    const neededSpeed = Math.ceil(remaining / Math.max(1, differenceInDays(new Date(project.deadline), new Date())))
    const acceleratedSpeed = Math.ceil(remaining / 7)
    const weeksToExtend = Math.ceil(Math.abs(forecast.daysAhead) / 7)

    if (forecast.status === 'ahead') {
      const relaxedSpeed = Math.round(forecast.avgSpeed * 0.8)
      return {
        emoji: '🚀',
        title: t('projects:forecast.aheadTitle'),
        message: t('projects:forecast.aheadMessage', {
          speed: formatNumber(forecast.avgSpeed),
          daysNeeded: forecast.daysNeeded,
          daysAhead: Math.abs(forecast.daysAhead),
          relaxedSpeed: formatNumber(relaxedSpeed)
        })
      }
    }

    if (forecast.status === 'behind') {
      return {
        emoji: '⚠️',
        title: t('projects:forecast.behindTitle'),
        message: t('projects:forecast.behindMessage', {
          speed: formatNumber(forecast.avgSpeed),
          daysNeeded: forecast.daysNeeded,
          daysBehind: Math.abs(forecast.daysAhead),
          neededSpeed: formatNumber(neededSpeed),
          acceleratedSpeed: formatNumber(acceleratedSpeed),
          weeks: weeksToExtend
        })
      }
    }

    return {
      emoji: '🎯',
      title: t('projects:forecast.ontrackTitle'),
      message: t('projects:forecast.ontrackMessage', {
        speed: formatNumber(forecast.avgSpeed),
        // не-nodata ветка гарантирует projectedFinish
        date: format(forecast.projectedFinish!, 'd MMMM yyyy', { locale: dfnsLocale() })
      })
    }
  }

  const daysLeft = differenceInDays(new Date(project.deadline), new Date())

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p>{t('projects:card.loading')}</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {project.title}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
              {getGenreLabel(project.genre)}
            </span>
            <span>
              {t('projects:card.deadline', { date: format(new Date(project.deadline), 'd MMM yyyy', { locale: dfnsLocale() }) })}
              {daysLeft >= 0 ? t('projects:card.daysLeft', { days: daysLeft }) : t('projects:card.overdue')}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(project)}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            {t('actions.edit')}
          </button>
          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: t('projects:confirm.deleteTitle'),
                message: t('projects:confirm.deleteMessage', { title: project.title }),
                confirmText: t('actions.delete'),
                variant: 'danger'
              })
              if (confirmed) {
                onDelete(project.id)
              }
            }}
            className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition"
          >
            {t('actions.delete')}
          </button>
        </div>
      </div>
      
      {/* Прогресс */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-700 dark:text-gray-300">{t('projects:card.progress')}</span>
          <span className="font-medium text-gray-800 dark:text-white">
            {formatNumber(progress.total)} / {formatNumber(project.targetSymbols)} ({progress.percentage}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all"
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>
      </div>
      
      {/* Адаптивная цель на сегодня */}
      {neededToday > 0 && (
        <div className="mb-4">
          {(() => {
            const pct = neededToday > 0 ? Math.min(Math.round((todaySymbols / neededToday) * 100), 100) : 100
            const done = todaySymbols >= neededToday
            const urgent = pct < 50
            return (
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                done
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                  : urgent
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
              }`}>
                <span className={`font-medium ${
                  done ? 'text-green-700 dark:text-green-300'
                  : urgent ? 'text-red-700 dark:text-red-300'
                  : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {done
                    ? t('projects:card.todayDone')
                    : urgent
                    ? t('projects:card.todayNeededUrgent', { count: formatNumber(neededToday) })
                    : t('projects:card.todayNeeded', { count: formatNumber(neededToday) })}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('projects:card.todayWritten', { count: formatNumber(todaySymbols) })}
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {/* Прогноз */}
      {forecastMessage && (
        <div className={`mb-4 p-4 rounded-lg border-2 ${
          forecast?.status === 'ahead'
            ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700'
            : forecast?.status === 'behind'
            ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
            : forecast?.status === 'nodata'
            ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
            : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{forecastMessage.emoji}</span>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800 dark:text-white mb-1">
                {forecastMessage.title}
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {forecastMessage.message}
              </p>
              {forecast?.status === 'behind' && forecast.projectedFinish && (
                <button
                  onClick={handleReplan}
                  className="mt-3 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
                >
                  {t('projects:forecast.replanButton', { date: format(forecast.projectedFinish, 'd MMM yyyy', { locale: dfnsLocale() }) })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Главы / структура */}
      <button
        onClick={() => setShowChapters(true)}
        className="w-full mb-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium"
      >
        📑 {chapterStats.total > 0
          ? t('projects:chapters.summary', { done: chapterStats.done, total: chapterStats.total })
          : t('projects:chapters.openEmpty')}
      </button>

      {/* Кнопка завершить */}
      {progress.percentage >= 80 && (
        <button
          onClick={() => onComplete(project.id)}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
        >
          {t('projects:card.completeBook')}
        </button>
      )}

      {/* Модалка достижения 50% */}
      <MilestoneModal
        isOpen={showMilestoneModal}
        onClose={() => setShowMilestoneModal(false)}
        milestoneData={milestoneData}
      />

      {/* Модалка глав */}
      <ChaptersModal
        projectId={project.id}
        projectTitle={project.title}
        isOpen={showChapters}
        onClose={() => setShowChapters(false)}
        onChange={loadProjectData}
      />
    </div>
  )
}

export default ProjectCard
