import { format } from 'date-fns'

/**
 * Локальная дата YYYY-MM-DD. Записи в приложении датируются локальным днём
 * пользователя, поэтому «сегодня» везде должно считаться так — `toISOString()`
 * дал бы UTC-дату, которая к западу от UTC вечером уже «завтра».
 */
export function todayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Date → локальная дата YYYY-MM-DD (вместо toISOString().split('T')[0]). */
export function toLocalDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/**
 * Парсит 'yyyy-MM-dd' как локальную полночь.
 * `new Date('yyyy-MM-dd')` парсит строку как UTC-полночь — в западных
 * таймзонах это предыдущий локальный день, что ломало расчёт серий.
 */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
