import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getChapters, saveChapter, deleteChapter, type Chapter } from '../services/databaseService'
import { useConfirm } from './ConfirmModal'
import { useToast } from './Toast'

interface ChaptersModalProps {
  projectId: string
  projectTitle: string
  isOpen: boolean
  onClose: () => void
  onChange?: () => void
}

const STATUSES: Array<Chapter['status']> = ['planned', 'draft', 'done']

const statusClasses: Record<Chapter['status'], string> = {
  planned: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
  draft: 'bg-amber-200 text-amber-800 dark:bg-amber-700/40 dark:text-amber-200',
  done: 'bg-green-200 text-green-800 dark:bg-green-700/40 dark:text-green-200',
}

function ChaptersModal({ projectId, projectTitle, isOpen, onClose, onChange }: ChaptersModalProps) {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [newTitle, setNewTitle] = useState('')

  const load = useCallback(async () => {
    setChapters(await getChapters(projectId))
  }, [projectId])

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, load])

  if (!isOpen) return null

  const total = chapters.length
  const done = chapters.filter(c => c.status === 'done').length

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    const maxPos = chapters.reduce((m, c) => Math.max(m, c.position), 0)
    await saveChapter({ id: Date.now().toString(), projectId, title, status: 'planned', position: maxPos + 1 })
    setNewTitle('')
    await load()
    onChange?.()
  }

  const handleStatus = async (chapter: Chapter, status: Chapter['status']) => {
    await saveChapter({ ...chapter, status })
    await load()
    onChange?.()
  }

  const handleDelete = async (chapter: Chapter) => {
    const ok = await confirm({
      title: t('projects:chapters.deleteTitle'),
      message: t('projects:chapters.deleteMessage', { title: chapter.title }),
      confirmText: t('actions.delete'),
      variant: 'danger'
    })
    if (!ok) return
    await deleteChapter(chapter.id)
    await load()
    onChange?.()
    showToast(t('common:undo.chapterDeleted'), 'info', {
      action: {
        label: t('common:undo.action'),
        onAction: async () => {
          await saveChapter(chapter)
          await load()
          onChange?.()
        }
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              📑 {t('projects:chapters.title', { project: projectTitle })}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">&times;</button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('projects:chapters.progress', { done, total })}</p>

          {total > 0 && (
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
          )}

          <div className="space-y-2 mb-4">
            {chapters.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{t('projects:chapters.empty')}</p>
            )}
            {chapters.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <span className="text-sm text-gray-400 w-6 text-right shrink-0">{i + 1}.</span>
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate">{c.title}</span>
                <div className="flex gap-1 shrink-0">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatus(c, s)}
                      className={`px-2 py-0.5 text-xs rounded-full transition ${c.status === s ? statusClasses[s] : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      {t(`projects:chapters.status.${s}`)}
                    </button>
                  ))}
                </div>
                <button onClick={() => handleDelete(c)} className="text-gray-400 hover:text-red-500 text-sm px-1 shrink-0" aria-label={t('actions.delete')}>🗑️</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={t('projects:chapters.addPlaceholder')}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm"
            />
            <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm whitespace-nowrap">
              {t('projects:chapters.add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChaptersModal
