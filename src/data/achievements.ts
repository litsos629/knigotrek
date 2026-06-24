// Определения достижений (декларативно, как changelog.ts).
//
// Достижения сгруппированы в «семейства» (family) — лестницы тиров, чтобы всегда
// был виден следующий шаг и прогрессия не «заканчивалась». Авто-достижения
// разблокируются, когда метрика (metric) пользователя достигает порога (threshold).
//
// Заголовки/описания берутся в UI через i18n по семейству (счётные — с плюрализацией),
// поэтому здесь только данные: id, метрика, порог, отображаемое число и эмодзи-тир.
//
// Приватность: всё считается из метаданных (числа/время), текст книги не используется.

export type AchievementMetric =
  | 'totalSymbols'
  | 'longestStreak'
  | 'activeDays'
  | 'focusMinutes'
  | 'totalSessions'
  | 'chaptersDone'
  | 'completedProjects'
  | 'maxSessionSymbols'
  | 'maxDaySymbols'
  | 'maxSessionMinutes'
  | 'accountAgeDays'
  | 'totalDeleted'

export type AchievementFamily =
  | 'volume'
  | 'streak'
  | 'activeDays'
  | 'focus'
  | 'sessions'
  | 'chapters'
  | 'projects'
  | 'feat'
  | 'creative'
  | 'ultra'

/** auto — открывается по метрике; manual — отмечается пользователем (эмоции). */
export type AchievementType = 'auto' | 'manual'

export interface AchievementDef {
  id: string
  family: AchievementFamily
  /** По умолчанию 'auto'. */
  type?: AchievementType
  /** Для auto: какая метрика. */
  metric?: AchievementMetric
  /** Для auto: значение метрики для разблокировки. */
  threshold?: number
  /** Число, показываемое в заголовке (для focus — часы, хотя метрика в минутах). */
  titleValue?: number
  emoji: string
  /** Скрытые не показываются до разблокировки (раскрываются по факту — приятный сюрприз). */
  hidden?: boolean
  /** Для скрытых: показывать заблюренным «слотом-мечтой», а не прятать полностью. */
  teaser?: boolean
}

const TIER_EMOJIS = ['🥉', '🥈', '🥇', '💎', '👑']

/** Эмодзи-тир по позиции порога внутри семейства (0..count-1 → бронза..легенда). */
function tierEmoji(index: number, count: number): string {
  if (count <= 1) return TIER_EMOJIS[2]
  const bucket = Math.round((index / (count - 1)) * (TIER_EMOJIS.length - 1))
  return TIER_EMOJIS[bucket]
}

interface Tier {
  /** Порог метрики. */
  threshold: number
  /** Отображаемое число (по умолчанию = threshold). */
  display?: number
}

/** Строит лестницу тиров одного семейства с авто-эмодзи и id вида `${family}_${i}`. */
function ladder(
  family: AchievementFamily,
  metric: AchievementMetric,
  tiers: Tier[],
): AchievementDef[] {
  return tiers.map((tier, i) => ({
    id: `${family}_${i + 1}`,
    family,
    metric,
    threshold: tier.threshold,
    titleValue: tier.display ?? tier.threshold,
    emoji: tierEmoji(i, tiers.length),
  }))
}

const t = (threshold: number, display?: number): Tier => ({ threshold, display })

export const ACHIEVEMENTS: AchievementDef[] = [
  // Объём (символы) — от первых шагов до эпоса
  ...ladder('volume', 'totalSymbols', [
    t(1_000), t(5_000), t(25_000), t(100_000), t(250_000),
    t(500_000), t(1_000_000), t(2_500_000), t(5_000_000),
  ]),

  // Стрик (дней подряд)
  ...ladder('streak', 'longestStreak', [
    t(3), t(7), t(14), t(30), t(60), t(90), t(180), t(365), t(1000),
  ]),

  // Всего дней с записями (накопительно — не сбрасывается при пропуске)
  ...ladder('activeDays', 'activeDays', [
    t(5), t(25), t(50), t(100), t(250), t(500), t(1000),
  ]),

  // Часы фокуса (метрика в минутах, показываем часы)
  ...ladder('focus', 'focusMinutes', [
    t(60, 1), t(300, 5), t(600, 10), t(1_500, 25), t(3_000, 50), t(6_000, 100),
  ]),

  // Всего сессий фокуса
  ...ladder('sessions', 'totalSessions', [
    t(1), t(10), t(50), t(100), t(250), t(500),
  ]),

  // Готовых глав
  ...ladder('chapters', 'chaptersDone', [
    t(1), t(5), t(10), t(25), t(50),
  ]),

  // Завершённых книг
  ...ladder('projects', 'completedProjects', [
    t(1), t(3), t(5), t(10),
  ]),

  // Одиночные «подвиги» (feat) — особые достижения, не лестница
  { id: 'feat_marathon', family: 'feat', metric: 'maxSessionSymbols', threshold: 1667, titleValue: 1667, emoji: '🏃' },
  { id: 'feat_weekend_warrior', family: 'feat', metric: 'maxDaySymbols', threshold: 5000, titleValue: 5000, emoji: '⚔️' },
  { id: 'feat_flow', family: 'feat', metric: 'maxSessionMinutes', threshold: 60, titleValue: 60, emoji: '🌊' },
  { id: 'feat_deep_dive', family: 'feat', metric: 'maxSessionMinutes', threshold: 180, titleValue: 180, emoji: '🧘' },

  // Творческие/эмоциональные — отмечаются пользователем вручную (текст книги не трогаем)
  { id: 'creative_tears', family: 'creative', type: 'manual', emoji: '😢' },
  { id: 'creative_laugh', family: 'creative', type: 'manual', emoji: '😂' },
  { id: 'creative_twist', family: 'creative', type: 'manual', emoji: '💡' },
  { id: 'creative_perfect_word', family: 'creative', type: 'manual', emoji: '✨' },
  { id: 'creative_character', family: 'creative', type: 'manual', emoji: '💗' },
  { id: 'creative_farewell', family: 'creative', type: 'manual', emoji: '⚰️' },
  { id: 'creative_the_end', family: 'creative', type: 'manual', emoji: '🏁' },
  { id: 'creative_permission', family: 'creative', type: 'manual', emoji: '🗑️' },
  { id: 'creative_converge', family: 'creative', type: 'manual', emoji: '🧩' },

  // Скрытые «легендарные» — переводят накопленное в человеческий масштаб (раскрываются по факту).
  // Капстоун (teaser) виден заблюренным «слотом-мечтой»; остальные полностью скрыты до открытия.
  { id: 'ultra_novel', family: 'ultra', metric: 'totalSymbols', threshold: 500_000, emoji: '📖', hidden: true },
  { id: 'ultra_lifetime', family: 'ultra', metric: 'focusMinutes', threshold: 6_000, emoji: '⏳', hidden: true },
  { id: 'ultra_year', family: 'ultra', metric: 'accountAgeDays', threshold: 365, emoji: '🗓️', hidden: true },
  { id: 'ultra_from_nothing', family: 'ultra', metric: 'totalSessions', threshold: 250, emoji: '🧱', hidden: true },
  { id: 'ultra_cut', family: 'ultra', metric: 'totalDeleted', threshold: 50_000, emoji: '✂️', hidden: true },
  { id: 'ultra_capstone', family: 'ultra', metric: 'totalSymbols', threshold: 1_000_000, emoji: '🌌', hidden: true, teaser: true },
]

/** Порядок семейств для отображения в карточке. */
export const FAMILY_ORDER: AchievementFamily[] = [
  'volume', 'streak', 'activeDays', 'focus', 'sessions', 'chapters', 'projects', 'feat', 'creative', 'ultra',
]

/** id достижений, отмечаемых вручную (эмоциональные моменты). */
export const MANUAL_ACHIEVEMENTS: AchievementDef[] = ACHIEVEMENTS.filter((a) => a.type === 'manual')
