import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from 'date-fns'
import { dfnsLocale } from '../i18n/dateLocale'

interface CalendarHeatmapProps {
  entries: Array<{date: string, symbols: number}>
}

const MONTHS_TO_SHOW = 6

function CalendarHeatmap({ entries }: CalendarHeatmapProps) {
  const { t } = useTranslation()
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  // Суммируем символы по дню: на одну дату может приходиться несколько записей
  // (по записи на проект). Раньше брали только первую через .find — при выборе
  // «Все проекты» цвет занижался. Теперь складываем все записи дня.
  const symbolsByDate = new Map<string, number>()
  for (const e of entries) {
    symbolsByDate.set(e.date, (symbolsByDate.get(e.date) || 0) + e.symbols)
  }

  // Группируем по КАЛЕНДАРНЫМ месяцам: каждый месяц — отдельный блок со своим
  // названием. Недели внутри блока начинаются с понедельника; дни соседнего
  // месяца (и будущие) становятся пустыми клетками, чтобы стык не «делился»
  // между двумя подписями.
  const months: { key: string; label: string; weeks: (Date | null)[][] }[] = []
  let cursor = startOfMonth(subMonths(today, MONTHS_TO_SHOW - 1))
  while (cursor <= today) {
    const monthStart = startOfMonth(cursor)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

    const weeks: (Date | null)[][] = []
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7).map(d =>
        isSameMonth(d, monthStart) && format(d, 'yyyy-MM-dd') <= todayStr ? d : null
      )
      weeks.push(week)
    }

    months.push({
      key: format(monthStart, 'yyyy-MM'),
      label: format(monthStart, 'LLLL', { locale: dfnsLocale() }),
      weeks,
    })
    cursor = subMonths(cursor, -1) // следующий месяц
  }

  // Функция для получения цвета квадрата
  const getColor = (date: Date) => {
    const symbols = symbolsByDate.get(format(date, 'yyyy-MM-dd')) || 0

    if (symbols === 0) return 'bg-gray-100 dark:bg-gray-700'
    if (symbols < 300) return 'bg-green-200 dark:bg-green-900'
    if (symbols < 700) return 'bg-green-400 dark:bg-green-700'
    if (symbols < 1200) return 'bg-green-600 dark:bg-green-500'
    return 'bg-green-800 dark:bg-green-300'
  }

  // Функция для получения текста тултипа
  const getTooltip = (date: Date) => {
    const symbols = symbolsByDate.get(format(date, 'yyyy-MM-dd')) || 0
    const formattedDate = format(date, 'd MMMM yyyy', { locale: dfnsLocale() })

    if (symbols === 0) {
      return t('home:calendar.noEntries', { date: formattedDate })
    }
    return t('home:calendar.withEntries', { date: formattedDate, count: symbols })
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
        {t('home:calendar.title')}
        <HelpTip text={t('common:help.calendar')} />
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('home:calendar.subtitle')}
      </p>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-3">
          {/* Столбец с днями недели */}
          <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 pr-1">
            <div className="h-[18px] mb-1"></div>
            {daysOfWeek.map((day, i) => (
              <div key={i} className="h-[18px] flex items-center">
                {day}
              </div>
            ))}
          </div>

          {/* Блоки месяцев */}
          {months.map((month) => (
            <div key={month.key} className="flex flex-col">
              {/* Название месяца по центру над блоком */}
              <div className="h-[18px] mb-1 text-xs text-gray-500 dark:text-gray-400 capitalize text-center">
                {month.label}
              </div>

              {/* Недели месяца (столбцы) */}
              <div className="flex gap-1">
                {month.weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((date, dayIndex) => {
                      if (!date) {
                        return <div key={dayIndex} className="w-[18px] h-[18px]"></div>
                      }

                      const isToday = format(date, 'yyyy-MM-dd') === todayStr

                      return (
                        <div
                          key={dayIndex}
                          className={`w-[18px] h-[18px] rounded ${getColor(date)} cursor-pointer hover:ring-2 hover:ring-indigo-400 transition ${
                            isToday ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''
                          }`}
                          title={getTooltip(date)}
                        ></div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-2 mt-4 text-xs text-gray-600 dark:text-gray-400">
        <span>{t('home:calendar.less')}</span>
        <div className="flex gap-1">
          <div className="w-[18px] h-[18px] bg-gray-100 dark:bg-gray-700 rounded"></div>
          <div className="w-[18px] h-[18px] bg-green-200 dark:bg-green-900 rounded"></div>
          <div className="w-[18px] h-[18px] bg-green-400 dark:bg-green-700 rounded"></div>
          <div className="w-[18px] h-[18px] bg-green-600 dark:bg-green-500 rounded"></div>
          <div className="w-[18px] h-[18px] bg-green-800 dark:bg-green-300 rounded"></div>
        </div>
        <span>{t('home:calendar.more')}</span>
      </div>
    </div>
  )
}

export default CalendarHeatmap
