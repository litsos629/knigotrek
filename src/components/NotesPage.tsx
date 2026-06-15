import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { format } from 'date-fns'
import { dfnsLocale } from '../i18n/dateLocale'
import { getNotes, saveNote, deleteNote, type Note } from '../services/databaseService'
import { useConfirm } from './ConfirmModal'
import { useToast } from './Toast'

function NotesPage() {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  // Загружаем заметки из БД
  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    const data = await getNotes()
    setNotes(data)
  }

  // Создать новую заметку
  const createNote = async () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: t('notes:defaultTitle'),
      content: '',
      date: new Date().toISOString()
    }
    await saveNote(newNote)
    await loadNotes()
    setSelectedNote(newNote)
    setEditTitle(newNote.title)
    setEditContent(newNote.content)
    setIsEditing(true)
  }

  // Сохранить изменения
  const saveEdit = async () => {
    if (!selectedNote) return
    
    const updatedNote: Note = {
      ...selectedNote,
      title: editTitle,
      content: editContent,
      date: new Date().toISOString()
    }
    await saveNote(updatedNote)
    await loadNotes()
    setSelectedNote(updatedNote)
    setIsEditing(false)
  }

  // Отменить редактирование
  const cancelEdit = () => {
    if (selectedNote) {
      setEditTitle(selectedNote.title)
      setEditContent(selectedNote.content)
    }
    setIsEditing(false)
  }

  // Удалить заметку
  const handleDeleteNote = async (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    
    const confirmed = await confirm({
      title: t('notes:deleteConfirm.title'),
      message: t('notes:deleteConfirm.message', { title: note.title }),
      confirmText: t('actions.delete'),
      variant: 'danger'
    })
    if (confirmed) {
      const deleted = notes.find(n => n.id === id)
      await deleteNote(id)
      await loadNotes()
      if (selectedNote?.id === id) {
        setSelectedNote(null)
      }
      if (deleted) {
        showToast(t('common:undo.noteDeleted'), 'info', {
          action: {
            label: t('common:undo.action'),
            onAction: async () => {
              await saveNote(deleted)
              await loadNotes()
            }
          }
        })
      }
    }
  }

  // Выбрать заметку
  const selectNote = (note: Note) => {
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    setIsEditing(false)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            📝 {t('notes:title')}
            <HelpTip text={t('common:help.notes')} />
          </h1>
          <button
            onClick={createNote}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            + {t('notes:create')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Список заметок */}
        <div className="col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <h2 className="font-bold text-gray-800 dark:text-white mb-3">
              {t('notes:allNotes', { count: notes.length })}
            </h2>
            
            {notes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                {t('notes:empty')}<br/>{t('notes:emptyHint')}
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] md:max-h-[600px] overflow-y-auto">
                {notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => selectNote(note)}
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedNote?.id === note.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-300 dark:border-indigo-600'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                    }`}
                  >
                    <p className="font-medium text-gray-800 dark:text-white truncate">
                      {note.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {format(new Date(note.date), 'd MMM yyyy, HH:mm', { locale: dfnsLocale() })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Просмотр/редактирование заметки */}
        <div className="col-span-1 md:col-span-2">
          {!selectedNote ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-gray-500 dark:text-gray-400">
                {t('notes:selectHint')}
              </p>
            </div>
          ) : isEditing ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t('notes:titlePlaceholder')}
                className="w-full text-2xl font-bold text-gray-800 dark:text-white mb-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder={t('notes:contentPlaceholder')}
                className="w-full h-[500px] text-gray-700 dark:text-gray-300 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white dark:bg-gray-700"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  {t('actions.save')}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  {t('actions.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{selectedNote.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {format(new Date(selectedNote.date), 'd MMMM yyyy, HH:mm', { locale: dfnsLocale() })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition"
                  >
                    {t('actions.edit')}
                  </button>
                  <button
                    onClick={() => handleDeleteNote(selectedNote.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                  >
                    {t('actions.delete')}
                  </button>
                </div>
              </div>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap min-h-[500px]">
                {selectedNote.content || (
                  <p className="text-gray-400 dark:text-gray-500 italic">{t('notes:noteEmpty')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotesPage