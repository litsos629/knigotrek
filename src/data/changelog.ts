// Журнал обновлений приложения.
//
// Новейшая версия — ПЕРВАЯ в массиве. Эти данные — единственный источник правды
// и для окна «Что нового» (показывается один раз, если пользователь ещё не видел
// последнюю версию), и для списка версий в Настройках. Версию для сравнения берём
// отсюда (`LATEST_VERSION`), а не из package.json — так одинаково работает и в
// Electron, и в браузере, без рассинхрона.
//
// При выпуске новой версии: добавить запись сверху и поднять `version` в package.json.

export interface ChangelogEntry {
  version: string
  /** Дата релиза в формате YYYY-MM-DD (локальная). */
  date: string
  ru: string[]
  en: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.3',
    date: '2026-06-24',
    ru: [
      '🏆 Достижения переработаны: теперь считаются и по каждой книге, и в общем обзоре «Все проекты» — на новой книге можно пройти путь заново, а общая летопись сохраняется.',
      'ℹ️ У каждой медали появилось пояснение по наведению: что нужно для открытия и сколько осталось.',
      '✨ Эмоциональные моменты можно снять или переотметить (с кнопкой «Отменить» сразу после отметки).',
      '🌌 Добавлены скрытые «легендарные» достижения — раскрываются по мере пути и показывают масштаб проделанного.',
      '🎉 Тёплые поздравления на крупных вехах и забавное сравнение объёма с «Войной и миром».',
      '📋 В Настройках список «Что нового» при разворачивании прокручивается, а не растягивает страницу.',
    ],
    en: [
      '🏆 Achievements reworked: now tracked per book and in an “All projects” overview — start fresh on a new book while your lifetime record stays intact.',
      'ℹ️ Every medal now has a hover tooltip: what it takes to unlock and how much is left.',
      '✨ Emotional moments can now be unmarked or re-marked (with an “Undo” right after marking).',
      '🌌 Added hidden “legendary” achievements — they reveal themselves along the way and show the scale of your work.',
      '🎉 Warm congratulations at major milestones, plus a fun comparison of your volume to War and Peace.',
      '📋 In Settings, the “What’s new” list now scrolls when expanded instead of stretching the page.',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-06-18',
    ru: [
      'Журнал обновлений: после установки новой версии появляется окно «Что нового», а полный список изменений всегда доступен в Настройках → «О программе».',
    ],
    en: [
      'Update log: a “What’s new” dialog appears after updating, and the full change history is always available in Settings → “About”.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-06-18',
    ru: [
      'Календарь активности переработан: дни сгруппированы по месяцам (отдельные блоки с подписью), период расширен с 8 недель до полугода, клетки крупнее, сегодняшний день подсвечен.',
      'Поддержка тёмной темы в карточке календаря.',
      'При выборе «Все проекты» цвет дня учитывает сумму символов по всем проектам.',
    ],
    en: [
      'Activity calendar redesigned: days are grouped by month (separate labelled blocks), the range is extended from 8 weeks to six months, cells are bigger, and today is highlighted.',
      'Dark theme support in the calendar card.',
      'With “All projects” selected, a day’s color now reflects the sum across all projects.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-15',
    ru: [
      'Первый публичный релиз Книготрека — бесплатного трекера прогресса для писателей с открытым исходным кодом.',
    ],
    en: [
      'First public release of Knigotrek — a free, open-source writing-progress tracker for authors.',
    ],
  },
]

/** Самая свежая версия — её анонсирует окно «Что нового». */
export const LATEST_VERSION = CHANGELOG[0].version
