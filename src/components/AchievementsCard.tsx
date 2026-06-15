import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'

interface AchievementsCardProps {
  totalSymbols: number
  entriesCount: number
  streak: number
  completedProjects?: number
}

interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
  unlocked: boolean
}

function AchievementsCard({ totalSymbols, entriesCount, streak, completedProjects = 0 }: AchievementsCardProps) {
  const { t } = useTranslation()
  const achievements: Achievement[] = [
    {
      id: 'first',
      emoji: '✨',
      title: t('home:achievements.items.first.title'),
      description: t('home:achievements.items.first.description'),
      unlocked: entriesCount > 0
    },
    {
      id: '1000',
      emoji: '🎯',
      title: t('home:achievements.items.1000.title'),
      description: t('home:achievements.items.1000.description'),
      unlocked: totalSymbols >= 1000
    },
    {
      id: '5000',
      emoji: '🚀',
      title: t('home:achievements.items.5000.title'),
      description: t('home:achievements.items.5000.description'),
      unlocked: totalSymbols >= 5000
    },
    {
      id: '10000',
      emoji: '⭐',
      title: t('home:achievements.items.10000.title'),
      description: t('home:achievements.items.10000.description'),
      unlocked: totalSymbols >= 10000
    },
    {
      id: 'first_book',
      emoji: '🏆',
      title: t('home:achievements.items.first_book.title'),
      description: t('home:achievements.items.first_book.description'),
      unlocked: completedProjects >= 1
    },
    {
      id: 'week',
      emoji: '🔥',
      title: t('home:achievements.items.week.title'),
      description: t('home:achievements.items.week.description'),
      unlocked: streak >= 7
    },
    {
      id: 'month',
      emoji: '💪',
      title: t('home:achievements.items.month.title'),
      description: t('home:achievements.items.month.description'),
      unlocked: streak >= 30
    }
  ]

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {t('home:achievements.title')}
          <HelpTip text={t('common:help.achievements')} />
        </h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {unlockedCount}/{achievements.length}
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-4 rounded-lg border-2 transition ${
              achievement.unlocked
                ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-300 dark:border-yellow-700'
                : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-50'
            }`}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">
                {achievement.unlocked ? achievement.emoji : '🔒'}
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-1">
                {achievement.title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {achievement.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AchievementsCard


