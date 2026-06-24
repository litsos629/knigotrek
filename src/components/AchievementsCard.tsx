import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { useToast } from './Toast'
import { formatNumber } from '../i18n/dateLocale'
import { FAMILY_ORDER, type AchievementDef, type AchievementFamily } from '../data/achievements'
import {
  loadStats,
  syncAchievements,
  buildViews,
  markManual,
  unmarkManual,
  loadManualUnlockedAnyScope,
  ALL_SCOPE,
  type AchievementView,
  type AchievementStats,
} from '../services/achievementsService'

interface AchievementsCardProps {
  /** Меняется при изменении данных (например, сумма символов) — триггер пересчёта. */
  refreshKey?: number
  /** 'all'/undefined — обзор (пожизненно); иначе достижения выбранной книги. */
  selectedProjectId?: string
}

/** Всплывающая подсказка к медали (имя + критерий/прогресс) — на hover и focus, как HelpTip. */
function MedalTip({ title, lines }: { title: string; lines: string[] }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-52 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-gray-700"
    >
      <span className="block font-semibold">{title}</span>
      {lines.map((l, i) => (
        <span key={i} className="mt-0.5 block text-gray-200">{l}</span>
      ))}
    </span>
  )
}

function AchievementsCard({ refreshKey = 0, selectedProjectId }: AchievementsCardProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [views, setViews] = useState<AchievementView[]>([])
  const [stats, setStats] = useState<AchievementStats | null>(null)
  // Открытое именно в этой области (для кнопки «Снять»: чужие книжные эмоции в обзоре
  // показываем через union, но снять их можно только в их книге, не отсюда).
  const [ownUnlocked, setOwnUnlocked] = useState<Set<string>>(new Set())
  // Бамп для пересчёта после ручной отметки/снятия эмоционального момента
  const [localRefresh, setLocalRefresh] = useState(0)

  // Область достижений: конкретная книга или общий обзор «Все проекты»
  const scope = selectedProjectId && selectedProjectId !== ALL_SCOPE ? selectedProjectId : ALL_SCOPE

  const titleOf = (def: AchievementDef): string =>
    def.family === 'feat'
      ? t(`achievements:feats.${def.id}.title`)
      : def.family === 'creative'
        ? t(`achievements:creative.${def.id}.title`)
        : def.family === 'ultra'
          ? t(`achievements:ultra.${def.id}.title`)
          : t(`achievements:families.${def.family}.title`, { value: formatNumber(def.titleValue ?? 0) })

  // Текст «легендарного»: капстоун собирается из живых чисел, остальные — статичны.
  const ultraDesc = (def: AchievementDef, s: AchievementStats | null): string => {
    if (def.id === 'ultra_capstone') {
      return t('achievements:ultra.ultra_capstone.desc', {
        symbols: formatNumber(s?.totalSymbols ?? 0),
        days: formatNumber(s?.activeDays ?? 0),
        hours: formatNumber(Math.round((s?.focusMinutes ?? 0) / 60)),
        books: formatNumber(s?.completedProjects ?? 0),
      })
    }
    return t(`achievements:ultra.${def.id}.desc`)
  }

  // Описание-критерий: у особых/эмоций/легендарных — свой текст; у лестниц — генерим из порога.
  const criterionOf = (def: AchievementDef): string => {
    if (def.family === 'feat') return t(`achievements:feats.${def.id}.desc`)
    if (def.family === 'creative') return t(`achievements:creative.${def.id}.desc`)
    if (def.family === 'ultra') return ultraDesc(def, stats)
    return t(`achievements:families.${def.family}.criterion`, { value: formatNumber(def.titleValue ?? def.threshold ?? 0) })
  }

  // Строки подсказки: критерий + (для закрытых авто) прогресс числами + отметка «открыто».
  const tipLines = (v: AchievementView): string[] => {
    const lines: string[] = []
    const crit = criterionOf(v)
    if (crit) lines.push(crit)
    if (!v.unlocked && v.type !== 'manual' && v.metric && v.threshold) {
      const remaining = Math.max(0, v.threshold - v.current)
      lines.push(
        t('achievements:progressLine', {
          current: formatNumber(v.current),
          threshold: formatNumber(v.threshold),
          percent: Math.round(v.progress * 100),
          remaining: formatNumber(remaining),
        }),
      )
    }
    if (v.unlocked) lines.push('✓ ' + t('achievements:unlockedLabel'))
    return lines
  }

  const handleMark = async (def: AchievementView) => {
    await markManual(def.id, scope)
    setLocalRefresh((v) => v + 1)
    showToast(t('achievements:markedToast', { title: titleOf(def) }), 'success', {
      action: {
        label: t('achievements:undo'),
        onAction: () => {
          unmarkManual(def.id, scope).then(() => setLocalRefresh((v) => v + 1))
        },
      },
    })
  }

  const handleUnmark = async (def: AchievementView) => {
    await unmarkManual(def.id, scope)
    setLocalRefresh((v) => v + 1)
    showToast(t('achievements:unmarkedToast', { title: titleOf(def) }), 'info')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const loaded = await loadStats(scope === ALL_SCOPE ? undefined : scope)
      const { unlockedIds, newlyUnlocked } = await syncAchievements(loaded, scope)
      if (cancelled) return
      // В обзоре «Все» эмоции показываем объединённо — «было хоть раз» в любой книге
      let merged = unlockedIds
      if (scope === ALL_SCOPE) {
        const union = await loadManualUnlockedAnyScope()
        if (cancelled) return
        merged = new Set([...unlockedIds, ...union])
      }
      setOwnUnlocked(unlockedIds)
      setStats(loaded)
      setViews(buildViews(loaded, merged))
      // Поздравляем только с тем, что открылось прямо сейчас (на первом запуске пусто).
      // Книги/легендарные — глобальные: тостим их только в обзоре, не в каждой книге.
      // У майлстоунов/легендарных — тёплый флейвор вместо сухого «открыто».
      for (const def of newlyUnlocked) {
        if (scope !== ALL_SCOPE && (def.family === 'projects' || def.family === 'ultra')) continue
        const flavor = t(`achievements:flavor.${def.id}`, { defaultValue: '' })
        const special = flavor || (def.family === 'ultra' ? ultraDesc(def, loaded) : '')
        showToast(
          special || t('achievements:unlockedToast', { title: titleOf(def) }),
          'success',
          special ? 7000 : undefined,
        )
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, localRefresh, scope])

  // Семейства «Книги» и «Легендарные» — только в обзоре (про весь путь, не про одну книгу)
  const families =
    scope === ALL_SCOPE ? FAMILY_ORDER : FAMILY_ORDER.filter((f) => f !== 'projects' && f !== 'ultra')

  const visibleViews = views.filter((v) => families.includes(v.family))
  const unlockedCount = visibleViews.filter((v) => v.unlocked).length

  const byFamily = (family: AchievementFamily) => views.filter((v) => v.family === family)

  // Забавное сравнение объёма с «Войной и миром» (~3 млн знаков) — только в обзоре
  const warPeace =
    scope === ALL_SCOPE && stats && stats.totalSymbols >= 300_000
      ? (stats.totalSymbols / 3_000_000).toFixed(1)
      : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {t('home:achievements.title')}
          <HelpTip text={t('common:help.achievements')} />
        </h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {unlockedCount}/{visibleViews.length}
        </span>
      </div>

      <div className="space-y-5">
        {families.map((family) => {
          const items = byFamily(family)
          if (items.length === 0) return null
          const familyUnlocked = items.filter((v) => v.unlocked).length
          const nextLocked = items.find((v) => !v.unlocked) // первый незакрытый = следующая цель

          // У легендарных скрываем «сколько всего» — чтобы сохранить интригу
          const countLabel =
            family === 'ultra'
              ? familyUnlocked > 0
                ? `${familyUnlocked} ★`
                : ''
              : `${familyUnlocked}/${items.length}`

          return (
            <div key={family}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t(`achievements:families.${family}.name`)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{countLabel}</span>
              </div>

              {family === 'ultra' ? (
                // Легендарные: полностью скрытые не рендерим; капстоун-teaser — заблюренный «слот-мечта»
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {items.map((v) => {
                    if (!v.unlocked && !v.teaser) return null
                    const revealed = v.unlocked
                    return (
                      <div
                        key={v.id}
                        tabIndex={0}
                        className={`group relative p-2 rounded-lg border text-center transition flex flex-col items-center focus:outline-none ${
                          revealed
                            ? 'bg-gradient-to-br from-fuchsia-50 to-indigo-50 dark:from-fuchsia-900/30 dark:to-indigo-900/30 border-fuchsia-300 dark:border-fuchsia-700'
                            : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className={`text-2xl ${revealed ? '' : 'blur-[3px] opacity-70'}`}>
                          {revealed ? v.emoji : '❓'}
                        </div>
                        <div
                          className={`text-[11px] leading-tight text-gray-700 dark:text-gray-300 mt-1 ${
                            revealed ? '' : 'blur-[2px] select-none'
                          }`}
                        >
                          {revealed ? titleOf(v) : '???'}
                        </div>
                        <MedalTip
                          title={revealed ? titleOf(v) : '★'}
                          lines={revealed ? tipLines(v) : [t('achievements:hiddenTeaser')]}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : family === 'feat' || family === 'creative' ? (
                // Плитки: «подвиги» (авто) и эмоции (отмечаются/снимаются вручную)
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {items.map((v) => (
                    <div
                      key={v.id}
                      tabIndex={0}
                      className={`group relative p-2 rounded-lg border text-center transition flex flex-col items-center focus:outline-none ${
                        v.unlocked
                          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-300 dark:border-yellow-700'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-70'
                      }`}
                    >
                      <div className="text-2xl">{v.unlocked ? v.emoji : '🔒'}</div>
                      <div className="text-[11px] leading-tight text-gray-700 dark:text-gray-300 mt-1">
                        {titleOf(v)}
                      </div>
                      {family === 'creative' &&
                        (!v.unlocked ? (
                          <button
                            onClick={() => handleMark(v)}
                            className="mt-2 px-2 py-0.5 text-[11px] rounded bg-indigo-600 text-white hover:bg-indigo-700 transition"
                          >
                            {t('achievements:markButton')}
                          </button>
                        ) : ownUnlocked.has(v.id) ? (
                          <button
                            onClick={() => handleUnmark(v)}
                            className="mt-2 px-2 py-0.5 text-[11px] rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                          >
                            {t('achievements:unmarkButton')}
                          </button>
                        ) : null)}
                      <MedalTip title={titleOf(v)} lines={tipLines(v)} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Лестница тиров: эмодзи-пипсы (открытые — цветные, закрытые — приглушены) */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {items.map((v) => (
                      <span
                        key={v.id}
                        tabIndex={0}
                        className={`group relative inline-flex items-center justify-center w-7 h-7 rounded-full text-base transition focus:outline-none ${
                          v.unlocked
                            ? 'bg-yellow-100 dark:bg-yellow-900/40 ring-1 ring-yellow-300 dark:ring-yellow-700'
                            : 'bg-gray-100 dark:bg-gray-700 opacity-50'
                        }`}
                      >
                        {v.unlocked ? v.emoji : '🔒'}
                        <MedalTip title={titleOf(v)} lines={tipLines(v)} />
                      </span>
                    ))}
                  </div>

                  {/* Прогресс к следующей цели */}
                  {nextLocked ? (
                    <div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all"
                          style={{ width: `${Math.round(nextLocked.progress * 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {titleOf(nextLocked)} · {Math.round(nextLocked.progress * 100)}%
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      ✓ {t(`achievements:families.${family}.name`)}: 100%
                    </div>
                  )}

                  {/* Забавное сравнение объёма с «Войной и миром» (только обзор) */}
                  {family === 'volume' && warPeace && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      {t('achievements:comparisonWarPeace', { n: warPeace })}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AchievementsCard
