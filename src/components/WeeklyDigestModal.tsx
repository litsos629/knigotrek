import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getEntries, getSessions, getProjects } from '../services/databaseService'
import { getSessionTags } from '../config/appConfig'
import { format, subDays, differenceInDays } from 'date-fns'
import { dfnsLocale, formatNumber } from '../i18n/dateLocale'

interface WeeklyDigestData {
  weekSymbols: number
  prevWeekSymbols: number
  diffPercent: number
  direction: 'up' | 'down' | 'same'
  bestDay: { date: string; symbols: number } | null
  worstDay: { date: string; symbols: number } | null
  activeDays: number
  streak: number
  projectProgress: Array<{ title: string; weekSymbols: number; totalProgress: number }> | null
  topTags: Array<{ tag: string; sessions: number; avgSpeed: number }>
  insight: string | null
}

interface WeeklyDigestModalProps {
  onClose: () => void
}

const STORAGE_KEY = 'knigotrek_weekly_digest_last'

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'EEEEEE d MMM', { locale: dfnsLocale() })
  } catch {
    return dateStr
  }
}

export function shouldShowWeeklyDigest(): boolean {
  const lastShown = localStorage.getItem(STORAGE_KEY)
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  if (lastShown === todayStr) return false

  // Show on Monday or if last shown > 7 days ago
  const isMonday = today.getDay() === 1
  if (isMonday) return true

  if (lastShown) {
    const daysSince = differenceInDays(today, new Date(lastShown))
    return daysSince >= 7
  }

  // First time — show if it's been at least a week of data
  return false
}

export function markDigestShown(): void {
  localStorage.setItem(STORAGE_KEY, format(new Date(), 'yyyy-MM-dd'))
}

function WeeklyDigestModal({ onClose }: WeeklyDigestModalProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<WeeklyDigestData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDigestData()
    markDigestShown()
  }, [])

  const loadDigestData = async () => {
    try {
      const [entries, sessions, projects] = await Promise.all([
        getEntries(),
        getSessions(),
        getProjects()
      ])

      const today = new Date()
      // Last week: Mon-Sun before today
      const thisMonday = subDays(today, ((today.getDay() + 6) % 7))
      const lastMonday = subDays(thisMonday, 7)
      const lastMondayStr = format(lastMonday, 'yyyy-MM-dd')
      const thisMondayStr = format(thisMonday, 'yyyy-MM-dd')
      const prevMondayStr = format(subDays(lastMonday, 7), 'yyyy-MM-dd')

      // This week entries (Mon–today) and last week entries
      const weekEntries = entries.filter(e => e.date >= lastMondayStr && e.date < thisMondayStr)
      const prevWeekEntries = entries.filter(e => e.date >= prevMondayStr && e.date < lastMondayStr)

      if (weekEntries.length === 0) {
        setData(null)
        setLoading(false)
        return
      }

      const weekSymbols = weekEntries.reduce((s, e) => s + e.symbols, 0)
      const prevWeekSymbols = prevWeekEntries.reduce((s, e) => s + e.symbols, 0)

      const diffPercent = prevWeekSymbols > 0
        ? Math.round(((weekSymbols - prevWeekSymbols) / prevWeekSymbols) * 100)
        : 0
      const direction: 'up' | 'down' | 'same' = Math.abs(diffPercent) < 5 ? 'same' : diffPercent > 0 ? 'up' : 'down'

      // Best/worst day
      const dayMap = new Map<string, number>()
      weekEntries.forEach(e => {
        dayMap.set(e.date, (dayMap.get(e.date) || 0) + e.symbols)
      })
      const daysArr = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])
      const bestDay = daysArr.length > 0 ? { date: daysArr[0][0], symbols: daysArr[0][1] } : null
      const worstDay = daysArr.length > 1 ? { date: daysArr[daysArr.length - 1][0], symbols: daysArr[daysArr.length - 1][1] } : null

      // Active days
      const activeDays = dayMap.size

      // Streak (current)
      const allDates = [...new Set(entries.map(e => e.date))].sort().reverse()
      let streak = 0
      const todayStr = format(today, 'yyyy-MM-dd')
      const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd')
      const checkDate = allDates.includes(todayStr) ? todayStr : (allDates.includes(yesterdayStr) ? yesterdayStr : null)
      if (checkDate) {
        streak = 1
        let d = subDays(new Date(checkDate), 1)
        while (allDates.includes(format(d, 'yyyy-MM-dd'))) {
          streak++
          d = subDays(d, 1)
        }
      }

      // Project progress
      const activeProjects = projects.filter(p => p.status === 'active')
      let projectProgress: WeeklyDigestData['projectProgress'] = null
      if (activeProjects.length > 0) {
        projectProgress = activeProjects.map(p => {
          const projWeekEntries = weekEntries.filter(e => e.projectId === p.id)
          const weekSym = projWeekEntries.reduce((s, e) => s + e.symbols, 0)
          const allProjEntries = entries.filter(e => e.projectId === p.id)
          const totalSym = allProjEntries.reduce((s, e) => s + e.symbols, 0)
          const totalProgress = Math.min(Math.round((totalSym / p.targetSymbols) * 100), 100)
          return { title: p.title, weekSymbols: weekSym, totalProgress }
        }).filter(p => p.weekSymbols > 0)
        if (projectProgress.length === 0) projectProgress = null
      }

      // Top tags
      const weekSessions = sessions.filter(s => {
        const sDate = s.date.split('T')[0]
        return sDate >= lastMondayStr && sDate < thisMondayStr && s.duration > 0
      })
      const tagMap = new Map<string, { totalSpeed: number; count: number }>()
      weekSessions.forEach(s => {
        const tags = getSessionTags(s)
        const speed = s.symbols / s.duration
        tags.forEach(tag => {
          const cur = tagMap.get(tag) || { totalSpeed: 0, count: 0 }
          tagMap.set(tag, { totalSpeed: cur.totalSpeed + speed, count: cur.count + 1 })
        })
      })
      const topTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([tag, stats]) => ({
          tag,
          sessions: stats.count,
          avgSpeed: Math.round((stats.totalSpeed / stats.count) * 10) / 10
        }))

      // Insight
      let insight: string | null = null
      if (direction === 'up' && diffPercent > 20) {
        insight = t('modals:digest.insightGreatWeek', { percent: diffPercent })
      } else if (activeDays >= 5) {
        insight = t('modals:digest.insightActiveDays', { count: activeDays })
      } else if (streak >= 7) {
        insight = t('modals:digest.insightStreak', { count: streak })
      } else if (bestDay && bestDay.symbols > weekSymbols / activeDays * 1.5) {
        insight = t('modals:digest.insightBestDay', { date: formatDate(bestDay.date) })
      }

      setData({
        weekSymbols, prevWeekSymbols, diffPercent, direction,
        bestDay, worstDay, activeDays, streak,
        projectProgress, topTags, insight
      })
    } catch (error) {
      console.error('Error loading digest:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // Нет данных (или ошибка загрузки) — тихо закрываемся, но через эффект:
  // вызов onClose() прямо в рендере — это setState родителя во время рендера
  useEffect(() => {
    if (!loading && !data) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data])

  if (loading || !data) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">{t('modals:digest.title')}</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
          </div>
          <div className="text-3xl font-bold">{formatNumber(data.weekSymbols)} <span className="text-base font-normal text-white/80">{t('modals:digest.symbols')}</span></div>
          {data.prevWeekSymbols > 0 && (
            <div className={`text-sm mt-1 ${data.direction === 'up' ? 'text-green-200' : data.direction === 'down' ? 'text-orange-200' : 'text-white/70'}`}>
              {data.direction === 'up' ? '↑' : data.direction === 'down' ? '↓' : '→'}{' '}
              {data.direction === 'same' ? t('modals:digest.sameLevel') :
                t('modals:digest.diff', { percent: Math.abs(data.diffPercent), direction: data.direction === 'up' ? t('modals:digest.directionMore') : t('modals:digest.directionLess') })}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.activeDays}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('modals:digest.activeDays')}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.streak}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('modals:digest.streak')}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {data.activeDays > 0 ? formatNumber(Math.round(data.weekSymbols / data.activeDays)) : 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('modals:digest.symbolsPerDay')}</p>
            </div>
          </div>

          {/* Best/worst day */}
          {data.bestDay && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t('modals:digest.bestDay')}</span>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {t('modals:digest.dayValue', { date: formatDate(data.bestDay.date), symbols: formatNumber(data.bestDay.symbols) })}
                </span>
              </div>
              {data.worstDay && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('modals:digest.quietDay')}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {t('modals:digest.dayValue', { date: formatDate(data.worstDay.date), symbols: formatNumber(data.worstDay.symbols) })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Project progress */}
          {data.projectProgress && data.projectProgress.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('modals:digest.projects')}</p>
              <div className="space-y-2">
                {data.projectProgress.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{p.title}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {t('modals:digest.projectValue', { symbols: formatNumber(p.weekSymbols), progress: p.totalProgress })}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 dark:bg-indigo-500 rounded-full" style={{ width: `${p.totalProgress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top tags */}
          {data.topTags.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('modals:digest.topTags')}</p>
              <div className="flex flex-wrap gap-2">
                {data.topTags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                    {tag.tag} <span className="text-gray-400 dark:text-gray-500">{t('modals:digest.tagSessions', { count: tag.sessions })}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Insight */}
          {data.insight && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <span className="text-lg">💡</span>
              <span className="text-sm text-amber-800 dark:text-amber-200">{data.insight}</span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition"
          >
            {t('modals:digest.continue')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WeeklyDigestModal
