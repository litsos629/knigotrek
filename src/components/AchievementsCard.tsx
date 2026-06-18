import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { useToast } from './Toast'
import { formatNumber } from '../i18n/dateLocale'
import { FAMILY_ORDER, type AchievementDef, type AchievementFamily } from '../data/achievements'
import { loadStats, syncAchievements, buildViews, type AchievementView } from '../services/achievementsService'

interface AchievementsCardProps {
  /** Меняется при изменении данных (например, сумма символов) — триггер пересчёта. */
  refreshKey?: number
}

function AchievementsCard({ refreshKey = 0 }: AchievementsCardProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [views, setViews] = useState<AchievementView[]>([])

  // Человекочитаемый заголовок достижения (семейство — шаблон с числом, feat — свой текст)
  const titleOf = (def: AchievementDef): string =>
    def.family === 'feat'
      ? t(`achievements:feats.${def.id}.title`)
      : t(`achievements:families.${def.family}.title`, { value: formatNumber(def.titleValue) })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stats = await loadStats()
      const { unlockedIds, newlyUnlocked } = await syncAchievements(stats)
      if (cancelled) return
      setViews(buildViews(stats, unlockedIds))
      // Поздравляем только с тем, что открылось прямо сейчас (на первом запуске пусто)
      for (const def of newlyUnlocked) {
        showToast(t('achievements:unlockedToast', { title: titleOf(def) }), 'success')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const unlockedCount = views.filter((v) => v.unlocked).length

  const byFamily = (family: AchievementFamily) => views.filter((v) => v.family === family)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {t('home:achievements.title')}
          <HelpTip text={t('common:help.achievements')} />
        </h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {unlockedCount}/{views.length}
        </span>
      </div>

      <div className="space-y-5">
        {FAMILY_ORDER.map((family) => {
          const items = byFamily(family)
          if (items.length === 0) return null
          const familyUnlocked = items.filter((v) => v.unlocked).length
          const nextLocked = items.find((v) => !v.unlocked) // первый незакрытый = следующая цель

          return (
            <div key={family}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t(`achievements:families.${family}.name`)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {familyUnlocked}/{items.length}
                </span>
              </div>

              {family === 'feat' ? (
                // «Подвиги» — отдельные плитки со своим названием и описанием
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {items.map((v) => (
                    <div
                      key={v.id}
                      title={t(`achievements:feats.${v.id}.desc`)}
                      className={`p-2 rounded-lg border text-center transition ${
                        v.unlocked
                          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-300 dark:border-yellow-700'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-60'
                      }`}
                    >
                      <div className="text-2xl">{v.unlocked ? v.emoji : '🔒'}</div>
                      <div className="text-[11px] leading-tight text-gray-700 dark:text-gray-300 mt-1">
                        {t(`achievements:feats.${v.id}.title`)}
                      </div>
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
                        title={titleOf(v)}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-base transition ${
                          v.unlocked
                            ? 'bg-yellow-100 dark:bg-yellow-900/40 ring-1 ring-yellow-300 dark:ring-yellow-700'
                            : 'bg-gray-100 dark:bg-gray-700 opacity-50'
                        }`}
                      >
                        {v.unlocked ? v.emoji : '🔒'}
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
                    <div className="text-xs text-green-600 dark:text-green-400">✓ {t('achievements:families.' + family + '.name')}: 100%</div>
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
