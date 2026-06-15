import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getAdvices, getDailyPlan, getTagAnalytics, getPersonalRecommendations, getProjectForecast,
  type AssistantAdvice, type DailyPlan, type TagAnalytics, type PersonalRecommendations, type ProjectForecast
} from '../services/assistantService'
import { getActiveGoals, refreshGoalProgress, type Goal } from '../services/goalsService'
import { formatNumber } from '../i18n/dateLocale'

interface AssistantCardProps {
  totalSymbols: number
  entriesCount: number
  streak: number
  last7DaysSymbols: number
  selectedProjectId?: string
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2 || data.every(d => d === 0)) return null
  const max = Math.max(...data, 1)
  const w = 120
  const h = 28
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-indigo-400 dark:text-indigo-300"
      />
    </svg>
  )
}

type DataLevel = 'none' | 'few' | 'enough' | 'project'

function AssistantCard({ totalSymbols, entriesCount, streak, last7DaysSymbols, selectedProjectId }: AssistantCardProps) {
  const { t, i18n } = useTranslation('assistant')
  const [advices, setAdvices] = useState<AssistantAdvice[]>(() => [{
    emoji: '👋', title: t('loading.title'), text: t('loading.text'), priority: 0
  }])
  const [forecast, setForecast] = useState<ProjectForecast | null>(null)
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null)
  const [tagAnalytics, setTagAnalytics] = useState<TagAnalytics | null>(null)
  const [personalRecs, setPersonalRecs] = useState<PersonalRecommendations | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [showTagsDetails, setShowTagsDetails] = useState(false)
  const [showRecsDetails, setShowRecsDetails] = useState(false)
  const [avgPerDay, setAvgPerDay] = useState(0)
  const [celebrateGoalId, setCelebrateGoalId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    loadData()
  }, [totalSymbols, entriesCount, streak, last7DaysSymbols, selectedProjectId, i18n.language])

  const loadData = async () => {
    try {
      const avg = entriesCount > 0 ? Math.round(totalSymbols / entriesCount) : 0
      setAvgPerDay(avg)

      const [advResult, planResult, tagsResult, recsResult, forecastResult] = await Promise.all([
        getAdvices(totalSymbols, entriesCount, streak, last7DaysSymbols, selectedProjectId),
        getDailyPlan(selectedProjectId),
        getTagAnalytics(selectedProjectId),
        getPersonalRecommendations(selectedProjectId),
        getProjectForecast(selectedProjectId)
      ])
      setAdvices(advResult)
      setDailyPlan(planResult)
      setTagAnalytics(tagsResult)
      setPersonalRecs(recsResult)
      setForecast(forecastResult)

      // Refresh goals progress and check for completions
      const updatedGoals = await refreshGoalProgress(selectedProjectId)
      if (updatedGoals.length === 0) {
        const freshGoals = await getActiveGoals(selectedProjectId)
        setGoals(freshGoals)
      } else {
        // Check if any goal just got completed
        const justCompleted = updatedGoals.find(g => g.completed && !goals.find(og => og.id === g.id && og.completed))
        if (justCompleted) {
          setCelebrateGoalId(justCompleted.id)
          setTimeout(() => setCelebrateGoalId(null), 3000)
        }
        setGoals(updatedGoals)
      }
    } catch (error) {
      console.error('Error loading assistant data:', error)
      setAdvices([{
        emoji: '👋', title: t('welcome.title'),
        text: t('welcome.text'), priority: 0
      }])
    }
  }

  // Determine data level for adaptive behavior
  const getDataLevel = (): DataLevel => {
    if (entriesCount === 0 && totalSymbols === 0) return 'none'
    if (entriesCount < 5) return 'few'
    if (forecast && forecast.status !== 'nodata') return 'project'
    return 'enough'
  }

  const dataLevel = getDataLevel()
  const hasTagInsights = tagAnalytics && (tagAnalytics.topInsights.length > 0 || tagAnalytics.weekComparison || tagAnalytics.dailyFact)
  const hasDetailedTagData = tagAnalytics && (tagAnalytics.allTags.length > 0 || tagAnalytics.combinations.length > 0 || tagAnalytics.recentTrend)

  // Compact mode: show just the header summary
  if (collapsed) {
    return (
      <div
        className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 rounded-lg shadow-lg p-4 border-2 border-indigo-100 dark:border-indigo-800/50 cursor-pointer hover:shadow-xl transition-shadow"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {dataLevel === 'none' ? '👋' : dataLevel === 'few' ? '🌱' : forecast ? forecast.emoji : '🧠'}
            </span>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                {dataLevel === 'none' ? t('collapsed.startWriting') :
                 dataLevel === 'few' ? t('collapsed.collectingData') :
                 forecast ? `${forecast.projectTitle}: ${forecast.title}` : t('collapsed.smartAssistant')}
              </h3>
              {dailyPlan && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('collapsed.today', { written: formatNumber(dailyPlan.writtenToday), target: formatNumber(dailyPlan.targetSymbols) })}
                </p>
              )}
            </div>
          </div>
          <button
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition p-1"
            aria-label={t('expand')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        {dailyPlan && (
          <div className="mt-2 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dailyPlan.completed ? 'bg-green-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${dailyPlan.progress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 rounded-lg shadow-lg p-6 border-2 border-indigo-100 dark:border-indigo-800/50">
      {/* Кнопка свернуть */}
      <div className="flex justify-end mb-2 -mt-2 -mr-2">
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition p-1"
          aria-label={t('collapse')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Адаптивное приветствие: нет данных */}
      {dataLevel === 'none' && (
        <div className="mb-5 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">👋</span>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white mb-1">{t('welcome.title')}</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {t('welcome.intro')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
                  {t('welcome.chipTrackProgress')}
                </span>
                <span className="text-xs px-2 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
                  {t('welcome.chipGetAdvice')}
                </span>
                <span className="text-xs px-2 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
                  {t('welcome.chipBuildHabit')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Адаптивное: мало данных */}
      {dataLevel === 'few' && (
        <div className="mb-5 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🌱</span>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-0.5">{t('fewData.title')}</h3>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {t('fewData.text', {
                  count: entriesCount,
                  word: t(entriesCount === 1 ? 'fewData.entryOne' : entriesCount < 5 ? 'fewData.entryFew' : 'fewData.entryMany'),
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Прогноз по проекту (всегда видимый, если есть данные) */}
      {forecast && dataLevel !== 'none' && (
        <div className={`mb-5 p-4 rounded-lg border-2 ${
          forecast.status === 'ahead'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50'
            : forecast.status === 'behind'
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/50'
            : forecast.status === 'nodata'
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{forecast.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-0.5">
                {forecast.projectTitle}: {forecast.title}
              </h3>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{forecast.message}</p>
              {forecast.progress > 0 && (
                <div className="mt-2">
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        forecast.progress >= 100 ? 'bg-green-500' :
                        forecast.status === 'behind' ? 'bg-orange-400' : 'bg-indigo-400'
                      }`}
                      style={{ width: `${forecast.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('forecast.stat', { written: formatNumber(forecast.totalWritten), target: formatNumber(forecast.targetSymbols), progress: forecast.progress })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* План на сегодня */}
      {dailyPlan && dataLevel !== 'none' && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">
              {dailyPlan.completed ? '\u2705 ' : '\uD83C\uDFAF '}{t('dailyPlan.title')}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('dailyPlan.stat', { written: formatNumber(dailyPlan.writtenToday), target: formatNumber(dailyPlan.targetSymbols) })}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dailyPlan.completed ? 'bg-green-500 dark:bg-green-400'
                : dailyPlan.progress < 50 && dailyPlan.source === 'deadline' ? 'bg-red-400 dark:bg-red-500'
                : dailyPlan.progress < 75 ? 'bg-amber-400 dark:bg-amber-500'
                : 'bg-indigo-500 dark:bg-indigo-400'
              }`}
              style={{ width: `${dailyPlan.progress}%` }}
            />
          </div>
          <p className={`text-xs mt-1.5 ${
            dailyPlan.completed ? 'text-green-600 dark:text-green-400 font-medium'
            : dailyPlan.progress < 50 && dailyPlan.source === 'deadline' ? 'text-red-600 dark:text-red-400 font-medium'
            : 'text-gray-500 dark:text-gray-400'
          }`}>
            {dailyPlan.message}
            {dailyPlan.source === 'deadline' && !dailyPlan.completed && dailyPlan.progress >= 50 && (
              <span className="text-gray-400 dark:text-gray-500">{t('dailyPlan.byDeadline')}</span>
            )}
            {dailyPlan.source === 'deadline' && !dailyPlan.completed && dailyPlan.progress < 50 && (
              <span className="font-medium">{t('dailyPlan.catchUp')}</span>
            )}
          </p>
        </div>
      )}

      {/* Цели и челленджи */}
        {goals.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-3">
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('goals.title')}</h4>
            </div>
            <div className="space-y-2.5">
              {goals.map(goal => {
                const progress = goal.target > 0 ? Math.min(Math.round((goal.current / goal.target) * 100), 100) : 0
                const isCelebrating = celebrateGoalId === goal.id
                return (
                  <div key={goal.id} className={`rounded-lg p-3 transition-all duration-300 ${
                    goal.completed
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50'
                      : 'bg-white/60 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700'
                  } ${isCelebrating ? 'ring-2 ring-green-400 dark:ring-green-500' : ''}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">{goal.completed ? '\u2705' : goal.emoji}</span>
                      <span className={`text-sm font-medium ${
                        goal.completed ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-white'
                      }`}>
                        {goal.completed && isCelebrating ? t('goals.completed') : goal.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{goal.description}</p>
                    {!goal.completed && goal.target > 1 && (
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 dark:bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {/* Советы */}
      <div className="space-y-4">
        {advices.map((advice, i) => (
          <div key={i} className={`flex items-start gap-4 ${i > 0 ? 'pt-4 border-t border-indigo-100 dark:border-indigo-800/50' : ''}`}>
            <div className="text-3xl flex-shrink-0">{advice.emoji}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">{advice.title}</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{advice.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Аналитика тегов */}
      {hasTagInsights && dataLevel !== 'none' && (
        <div className="mt-5 pt-4 border-t border-indigo-200 dark:border-indigo-800/50">
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('tags.insights')}</h4>

          {/* Топ-3 тега */}
          {tagAnalytics!.topInsights.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {tagAnalytics!.topInsights.map((ins, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`text-base ${ins.direction === 'up' ? 'text-green-500' : 'text-orange-500'}`}>
                    {ins.direction === 'up' ? '\u2191' : '\u2193'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{ins.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Сравнение недель */}
          {tagAnalytics!.weekComparison && (
            <div className="flex items-center gap-2 text-sm mb-3">
              <span className={`text-base ${
                tagAnalytics!.weekComparison.direction === 'up' ? 'text-green-500' :
                tagAnalytics!.weekComparison.direction === 'down' ? 'text-orange-500' : 'text-gray-400'
              }`}>
                {tagAnalytics!.weekComparison.direction === 'up' ? '\uD83D\uDCC8' :
                 tagAnalytics!.weekComparison.direction === 'down' ? '\uD83D\uDCC9' : '\u27A1\uFE0F'}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{tagAnalytics!.weekComparison.text}</span>
            </div>
          )}

          {/* Мини-факт дня */}
          {tagAnalytics!.dailyFact && !tagAnalytics!.topInsights.some(t => t.text === tagAnalytics!.dailyFact) && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">{'\uD83D\uDCA1'}</span>
              <span className="text-gray-600 dark:text-gray-400 italic">{tagAnalytics!.dailyFact}</span>
            </div>
          )}

          {/* Превью + кнопка «Подробнее» */}
          {hasDetailedTagData && (
            <>
              {!showTagsDetails && (
                <div className="mt-3 opacity-60">
                  {tagAnalytics!.recentTrend && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">{tagAnalytics!.recentTrend}</p>
                  )}
                  {tagAnalytics!.allTags.length > 0 && !tagAnalytics!.recentTrend && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
                      {t('tags.previewTag', { tag: tagAnalytics!.allTags[0].tag, sessions: tagAnalytics!.allTags[0].sessionsCount, speed: tagAnalytics!.allTags[0].avgSpeed.toFixed(1) })}
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowTagsDetails(!showTagsDetails)}
                className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition flex items-center gap-1"
              >
                {showTagsDetails ? t('tags.hideDetails') : t('tags.details')}
              </button>
            </>
          )}

          {/* Подробная панель аналитики */}
          {showTagsDetails && hasDetailedTagData && (
              <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/50 space-y-4">
                {/* Тренд (спарклайн) */}
                {tagAnalytics!.sparklineData.some(d => d > 0) && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('tags.symbols7weeks')}</p>
                    <Sparkline data={tagAnalytics!.sparklineData} />
                  </div>
                )}

                {/* Recent trend */}
                {tagAnalytics!.recentTrend && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{tagAnalytics!.recentTrend}</p>
                )}

                {/* Полная таблица тегов */}
                {tagAnalytics!.allTags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('tags.allTags')}</p>
                    <div className="space-y-1">
                      {tagAnalytics!.allTags.map((tagRow, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 dark:text-gray-300">{tagRow.tag}</span>
                          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                            <span>{tagRow.sessionsCount} {t('tags.sessionsShort')}</span>
                            <span>{tagRow.avgSpeed.toFixed(1)} {t('tags.speedUnit')}</span>
                            <span className={
                              tagRow.direction === 'up' ? 'text-green-500' :
                              tagRow.direction === 'down' ? 'text-orange-500' : ''
                            }>
                              {tagRow.diffPercent > 0 ? '+' : ''}{tagRow.diffPercent}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Комбинации */}
                {tagAnalytics!.combinations.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('tags.bestCombinations')}</p>
                    <div className="space-y-1">
                      {tagAnalytics!.combinations.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 dark:text-gray-300">{c.tags.join(' + ')}</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {t('tags.combinationStat', { symbols: formatNumber(c.avgSymbols), speed: c.avgSpeed, sessions: c.sessionsCount })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          )}
        </div>
      )}

      {/* Персональные рекомендации */}
      {personalRecs && personalRecs.topRecs.length > 0 && dataLevel !== 'none' && (
        <div className="mt-5 pt-4 border-t border-indigo-200 dark:border-indigo-800/50">
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('recommendations.title')}</h4>

          {/* Краткий блок: 1-2 текстовые рекомендации */}
          <div className="space-y-2 mb-2">
            {personalRecs.topRecs.map((rec, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-base">{rec.emoji}</span>
                <span className="text-gray-700 dark:text-gray-300">{rec.text}</span>
              </div>
            ))}
          </div>

          {/* Daily recommendation */}
          {personalRecs.dailyRec && (
            <div className="flex items-center gap-2 text-sm mt-2">
              <span className="text-base">{'\uD83D\uDCA1'}</span>
              <span className="text-gray-600 dark:text-gray-400 italic">{personalRecs.dailyRec}</span>
            </div>
          )}

          {/* Превью + кнопка «Подробнее» */}
          {(personalRecs.timeSlots.length >= 2 || personalRecs.durationBuckets.length >= 2 || personalRecs.breakPattern) && (
            <>
              {!showRecsDetails && (
                <div className="mt-3 opacity-60">
                  {personalRecs.timeSlots.length >= 2 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
                      {t('recommendations.previewTimeSlot', { label: personalRecs.timeSlots[0].label, speed: personalRecs.timeSlots[0].avgSpeed, sessions: personalRecs.timeSlots[0].sessions })}
                    </p>
                  )}
                  {personalRecs.breakPattern && !personalRecs.timeSlots.length && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
                      {personalRecs.breakPattern.text.substring(0, 60)}...
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowRecsDetails(!showRecsDetails)}
                className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition flex items-center gap-1"
              >
                {showRecsDetails ? t('recommendations.hideDetails') : t('recommendations.details')}
              </button>
            </>
          )}

          {/* Детальная панель рекомендаций */}
          {showRecsDetails && (
            <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/50 space-y-4">
              {/* Time of day table */}
              {personalRecs.timeSlots.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('recommendations.byTimeOfDay')}</p>
                  <div className="space-y-1">
                    {personalRecs.timeSlots.map((slot, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={`text-gray-700 dark:text-gray-300 ${i === 0 ? 'font-medium' : ''}`}>
                          {i === 0 ? '\u2B50 ' : ''}{slot.label}
                        </span>
                        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                          <span>{slot.sessions} {t('recommendations.sessionsShort')}</span>
                          <span>{slot.avgSymbols} {t('recommendations.symbolsShort')}</span>
                          <span>{slot.avgSpeed} {t('recommendations.speedUnit')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration buckets table */}
              {personalRecs.durationBuckets.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('recommendations.byDuration')}</p>
                  <div className="space-y-1">
                    {[...personalRecs.durationBuckets].sort((a, b) => b.avgSpeed - a.avgSpeed).map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={`text-gray-700 dark:text-gray-300 ${i === 0 ? 'font-medium' : ''}`}>
                          {i === 0 ? '\u2B50 ' : ''}{b.label} ({b.range})
                        </span>
                        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                          <span>{b.sessions} {t('recommendations.sessionsShort')}</span>
                          <span>{b.avgSymbols} {t('recommendations.symbolsShort')}</span>
                          <span>{b.avgSpeed} {t('recommendations.speedUnit')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Break pattern */}
              {personalRecs.breakPattern && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-base">{'\uD83D\uDD04'}</span>
                  <span className="text-gray-700 dark:text-gray-300">{personalRecs.breakPattern.text}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Статистика */}
      {avgPerDay > 0 && (
        <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800/50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-indigo-600 dark:text-indigo-400 font-medium">{t('stats.avgPace')}</p>
              <p className="text-gray-800 dark:text-white font-bold">{t('stats.avgPaceValue', { value: avgPerDay })}</p>
            </div>
            <div>
              <p className="text-purple-600 dark:text-purple-400 font-medium">{t('stats.perWeek')}</p>
              <p className="text-gray-800 dark:text-white font-bold">{t('stats.perWeekValue', { value: formatNumber(last7DaysSymbols) })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssistantCard
