import { ru, enUS } from 'date-fns/locale'
import i18n from './index'

/** Локаль date-fns под текущий язык приложения (для format/formatDistance). */
export function dfnsLocale() {
  return i18n.language === 'en' ? enUS : ru
}

/** BCP47-тег для Intl (toLocaleString/toLocaleDateString) под текущий язык. */
export function intlLocale(): string {
  return i18n.language === 'en' ? 'en-US' : 'ru-RU'
}

/**
 * Число по локали приложения (не ОС): «1 234» в ru, "1,234" в en.
 * Используйте вместо голого toLocaleString() — тот берёт локаль системы,
 * и формат расходится с языком интерфейса.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString(intlLocale())
}
