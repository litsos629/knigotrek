interface HelpTipProps {
  /** Готовый (уже переведённый) текст подсказки */
  text: string
  /** aria-label кнопки; по умолчанию = тексту подсказки */
  label?: string
}

/**
 * Маленькая иконка «?» рядом с заголовком раздела. Подсказка появляется
 * по наведению и по фокусу с клавиатуры (доступно), работает в тёмной теме.
 */
export default function HelpTip({ text, label }: HelpTipProps) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ?? text}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold leading-none text-gray-500 transition-colors hover:border-indigo-400 hover:text-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-gray-700"
      >
        {text}
      </span>
    </span>
  )
}
