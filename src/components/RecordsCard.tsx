import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { format } from 'date-fns'
import { dfnsLocale, formatNumber } from '../i18n/dateLocale'

interface RecordsCardProps {
  entries: Array<{date: string, symbols: number}>
  currentStreak: number
}

function RecordsCard({ entries, currentStreak }: RecordsCardProps) {
  const { t } = useTranslation()
  if (entries.length === 0) {
    return null // Не показываем, если нет записей
  }
  
  // Лучший день
  const bestDay = entries.reduce((best, entry) => 
    entry.symbols > best.symbols ? entry : best
  , entries[0])
  
  // Longest streak (когда-либо)
  const calculateLongestStreak = () => {
    if (entries.length === 0) return 0
    
    const sortedDates = entries
      .map(e => e.date)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    
    let longestStreak = 1
    let currentStreakCount = 1
    
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1])
      const currDate = new Date(sortedDates[i])
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        currentStreakCount++
        longestStreak = Math.max(longestStreak, currentStreakCount)
      } else {
        currentStreakCount = 1
      }
    }
    
    return longestStreak
  }
  
  const longestStreak = calculateLongestStreak()
  
  // Самая продуктивная неделя (7 дней подряд)
  const getMostProductiveWeek = () => {
    if (entries.length < 7) return 0
    
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    let maxWeekSymbols = 0
    
    for (let i = 0; i <= sortedEntries.length - 7; i++) {
      const weekEntries = sortedEntries.slice(i, i + 7)
      const weekSymbols = weekEntries.reduce((sum, e) => sum + e.symbols, 0)
      maxWeekSymbols = Math.max(maxWeekSymbols, weekSymbols)
    }
    
    return maxWeekSymbols
  }
  
  const mostProductiveWeek = getMostProductiveWeek()

  const longestStreakLabel = longestStreak === 1
    ? t('home:records.dayOne', { count: longestStreak })
    : longestStreak < 5
      ? t('home:records.dayFew', { count: longestStreak })
      : t('home:records.dayMany', { count: longestStreak })

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        {t('home:records.title')}
        <HelpTip text={t('common:help.records')} />
      </h2>

      <div className="space-y-4">
        {/* Лучший день */}
        <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
          <div>
            <p className="text-sm text-yellow-700 font-medium">{t('home:records.bestDay')}</p>
            <p className="text-2xl font-bold text-yellow-800">{t('home:records.bestDaySymbols', { value: formatNumber(bestDay.symbols) })}</p>
            <p className="text-xs text-yellow-600 mt-1">
              {format(new Date(bestDay.date), 'd MMMM yyyy', { locale: dfnsLocale() })}
            </p>
          </div>
          <div className="text-4xl">🏆</div>
        </div>

        {/* Longest streak */}
        <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
          <div>
            <p className="text-sm text-orange-700 font-medium">{t('home:records.longestStreak')}</p>
            <p className="text-2xl font-bold text-orange-800">{longestStreakLabel}</p>
            <p className="text-xs text-orange-600 mt-1">
              {longestStreak === currentStreak ? t('home:records.activeNow') : t('home:records.recordPast')}
            </p>
          </div>
          <div className="text-4xl">🔥</div>
        </div>

        {/* Самая продуктивная неделя */}
        {mostProductiveWeek > 0 && (
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
            <div>
              <p className="text-sm text-purple-700 font-medium">{t('home:records.mostProductiveWeek')}</p>
              <p className="text-2xl font-bold text-purple-800">{t('home:records.mostProductiveWeekSymbols', { value: formatNumber(mostProductiveWeek) })}</p>
              <p className="text-xs text-purple-600 mt-1">{t('home:records.over7Days')}</p>
            </div>
            <div className="text-4xl">⚡</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecordsCard