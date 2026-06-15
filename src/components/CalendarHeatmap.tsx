import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { dfnsLocale } from '../i18n/dateLocale'

interface CalendarHeatmapProps {
  entries: Array<{date: string, symbols: number}>
}

function CalendarHeatmap({ entries }: CalendarHeatmapProps) {
  const { t } = useTranslation()
  // Получаем последние 8 недель (56 дней)
  const today = new Date()
  const startDate = subDays(today, 55) // 8 недель назад
  
  // Группируем по неделям
  const weeks: Date[][] = []
  let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 }) // Понедельник
  
  while (currentWeekStart <= today) {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })
    const daysInWeek = eachDayOfInterval({ 
      start: currentWeekStart, 
      end: weekEnd > today ? today : weekEnd 
    })
    weeks.push(daysInWeek)
    currentWeekStart = subDays(currentWeekStart, -7) // Следующая неделя
  }
  
  // Функция для получения цвета квадрата
  const getColor = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const entry = entries.find(e => e.date === dateStr)
    
    if (!entry || entry.symbols === 0) return 'bg-gray-100'
    if (entry.symbols < 300) return 'bg-green-200'
    if (entry.symbols < 700) return 'bg-green-400'
    if (entry.symbols < 1200) return 'bg-green-600'
    return 'bg-green-800'
  }
  
  // Функция для получения текста тултипа
  const getTooltip = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const entry = entries.find(e => e.date === dateStr)
    const formattedDate = format(date, 'd MMMM yyyy', { locale: dfnsLocale() })
    
    if (!entry || entry.symbols === 0) {
      return t('home:calendar.noEntries', { date: formattedDate })
    }
    return t('home:calendar.withEntries', { date: formattedDate, count: entry.symbols })
  }

  const daysOfWeek = [
    t('home:calendar.days.mon'),
    t('home:calendar.days.tue'),
    t('home:calendar.days.wed'),
    t('home:calendar.days.thu'),
    t('home:calendar.days.fri'),
    t('home:calendar.days.sat'),
    t('home:calendar.days.sun'),
  ]
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        {t('home:calendar.title')}
        <HelpTip text={t('common:help.calendar')} />
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        {t('home:calendar.subtitle')}
      </p>
      
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1">
          {/* Столбец с днями недели */}
          <div className="flex flex-col gap-1 text-xs text-gray-500 pr-2">
            <div className="h-3"></div>
            {daysOfWeek.map((day, i) => (
              <div key={i} className="h-3 flex items-center">
                {day}
              </div>
            ))}
          </div>
          
          {/* Недели */}
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {/* Месяц над первой неделей */}
              <div className="h-3 text-xs text-gray-500">
                {weekIndex === 0 || format(week[0], 'M') !== format(weeks[weekIndex - 1][0], 'M')
                  ? format(week[0], 'LLL', { locale: dfnsLocale() })
                  : ''}
              </div>
              
              {/* Дни недели */}
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const date = week[dayIndex]
                if (!date) {
                  return <div key={dayIndex} className="w-3 h-3"></div>
                }
                
                return (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm ${getColor(date)} cursor-pointer hover:ring-2 hover:ring-indigo-400 transition`}
                    title={getTooltip(date)}
                  ></div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Легенда */}
      <div className="flex items-center gap-2 mt-4 text-xs text-gray-600">
        <span>{t('home:calendar.less')}</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
          <div className="w-3 h-3 bg-green-200 rounded-sm"></div>
          <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
          <div className="w-3 h-3 bg-green-600 rounded-sm"></div>
          <div className="w-3 h-3 bg-green-800 rounded-sm"></div>
        </div>
        <span>{t('home:calendar.more')}</span>
      </div>
    </div>
  )
}

export default CalendarHeatmap