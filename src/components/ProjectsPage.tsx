import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import HelpTip from './HelpTip'
import { getProjects, saveProject, deleteProject, getEntries, getSessions, type Project } from '../services/databaseService'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import ProjectCard from './ProjectCard'
import CompletedProjectCard from './CompletedProjectCard'
import ProjectCompletionModal from './ProjectCompletionModal'
import type { MilestoneData } from '../services/pdfService'
import { genres, getGenreHint, getGenreLabel } from '../config/appConfig'
import { format } from 'date-fns'
import { dfnsLocale } from '../i18n/dateLocale'

function ProjectsPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [projects, setProjects] = useState<Project[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Модалка завершения проекта
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completedProject, setCompletedProject] = useState<Project | null>(null)
  const [completionMilestoneData, setCompletionMilestoneData] = useState<MilestoneData | null>(null)

  // Форма
  const [formTitle, setFormTitle] = useState('')
  const [formGenre, setFormGenre] = useState<string>(genres[0].id)
  const [formTarget, setFormTarget] = useState('100000')
  const [formDeadline, setFormDeadline] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPhase, setFormPhase] = useState<'draft' | 'revision'>('draft')

  // Загружаем проекты
  useEffect(() => {
    loadProjects()
  }, [])

  // Мягкое перепланирование: сдвинуть дедлайн проекта на реалистичную дату
  const replanProject = async (project: Project, newDeadline: string) => {
    const updated: Project = { ...project, deadline: newDeadline }
    await saveProject(updated)
    await loadProjects()
    showToast(t('projects:forecast.replanDone', { date: format(new Date(newDeadline), 'd MMMM yyyy', { locale: dfnsLocale() }) }), 'success')
  }

  const loadProjects = async () => {
    const data = await getProjects()
    setProjects(data)
  }
  
  // Получаем записи для проекта
  const getProjectEntries = async (projectId: string) => {
    const allEntries = await getEntries()
    return allEntries.filter((e) => e.projectId === projectId)
  }
  
  // Считаем прогресс
  const getProgress = async (project: Project) => {
    const entries = await getProjectEntries(project.id)
    const total = entries.reduce((sum: number, e) => sum + e.symbols, 0)
    return {
      total,
      percentage: Math.min(Math.round((total / project.targetSymbols) * 100), 100)
    }
  }
  
  // Открыть форму создания
  const openCreateForm = () => {
    setFormTitle('')
    setFormGenre(genres[0].id)
    setFormTarget('100000')
    setFormDeadline('')
    setFormDescription('')
    setFormPhase('draft')
    setIsCreating(true)
    setEditingId(null)
  }
  
  // Открыть форму редактирования
  const openEditForm = (project: Project) => {
    setFormTitle(project.title)
    setFormGenre(project.genre)
    setFormTarget(project.targetSymbols.toString())
    setFormDeadline(project.deadline)
    setFormDescription(project.description || '')
    setFormPhase(project.phase || 'draft')
    setEditingId(project.id)
    setIsCreating(false)
  }
  
  // Создать проект
  const createProject = async () => {
    if (!formTitle.trim()) {
      showToast(t('projects:validation.titleRequired'), 'warning')
      return
    }

    const target = parseInt(formTarget)
    if (isNaN(target) || target <= 0) {
      showToast(t('projects:validation.targetInvalid'), 'warning')
      return
    }

    if (!formDeadline) {
      showToast(t('projects:validation.deadlineRequired'), 'warning')
      return
    }
    
    const newProject: Project = {
      id: Date.now().toString(),
      title: formTitle,
      genre: formGenre,
      targetSymbols: target,
      startDate: new Date().toISOString(),
      deadline: formDeadline,
      status: 'active',
      phase: formPhase,
      description: formDescription || undefined
    }
    
    await saveProject(newProject)
    await loadProjects()
    setIsCreating(false)
  }
  
  // Обновить проект
  const updateProject = async () => {
    if (!editingId) return
    
    const project = projects.find(p => p.id === editingId)
    if (!project) return
    
    const updatedProject: Project = {
      ...project,
      title: formTitle,
      genre: formGenre,
      targetSymbols: parseInt(formTarget),
      deadline: formDeadline,
      phase: formPhase,
      description: formDescription || undefined
    }
    
    await saveProject(updatedProject)
    await loadProjects()
    setEditingId(null)
  }
  
  // Завершить проект (с конфетти!)
  const completeProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    
    const progress = await getProgress(project)
    
    if (progress.percentage < 100) {
      const confirmed = await confirm({
        title: t('projects:confirm.completeTitle'),
        message: t('projects:confirm.completeMessage', { percentage: progress.percentage }),
        confirmText: t('projects:confirm.completeConfirm'),
        variant: 'warning'
      })
      if (!confirmed) return
    }
    
    const updatedProject: Project = {
      ...project,
      status: 'completed',
      completedDate: new Date().toISOString()
    }
    
    await saveProject(updatedProject)
    await loadProjects()
    
    // Собираем данные для финального отчета
    const entries = await getEntries()
    const projectEntries = entries.filter(e => e.projectId === project.id)
    const total = projectEntries.reduce((sum, e) => sum + e.symbols, 0)
    
    const sessions = await getSessions()
    const projectSessions = sessions.filter(s => s.projectId === project.id)
    
    // Лучший день
    const bestDay = Math.max(...projectEntries.map(e => e.symbols), 0)
    
    // Средний темп
    const today = new Date()
    const startDate = new Date(project.startDate)
    const daysWorked = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const averageSpeed = daysWorked > 0 ? Math.round(total / daysWorked) : 0
    
    // Streak (упрощенный расчет)
    const sortedDates = projectEntries.map(e => e.date).sort()
    let streak = 0
    if (sortedDates.length > 0) {
      const lastDate = new Date(sortedDates[sortedDates.length - 1])
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      lastDate.setHours(0, 0, 0, 0)
      const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff <= 1) {
        streak = 1
        const checkDate = new Date(lastDate)
        for (let i = sortedDates.length - 2; i >= 0; i--) {
          const prevDate = new Date(sortedDates[i])
          prevDate.setHours(0, 0, 0, 0)
          const diff = Math.floor((checkDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
          if (diff === 1) {
            streak++
            checkDate.setTime(prevDate.getTime())
          } else {
            break
          }
        }
      }
    }

    const milestoneDataForReport: MilestoneData = {
      project: {
        id: project.id,
        title: project.title,
        genre: project.genre,
        targetSymbols: project.targetSymbols,
        startDate: project.startDate,
        deadline: project.deadline
      },
      stats: {
        totalSymbols: total,
        targetSymbols: project.targetSymbols,
        progress: progress.percentage,
        daysWorked,
        startDate: project.startDate,
        deadline: project.deadline,
        completedDate: updatedProject.completedDate,
        bestDay,
        averageSpeed,
        streak,
        totalSessions: projectSessions.length
      }
    }
    
    setCompletedProject(updatedProject)
    setCompletionMilestoneData(milestoneDataForReport)
    setShowCompletionModal(true)
    
    // КОНФЕТТИ!
    showConfetti()
  }
  
  // Конфетти
  const showConfetti = () => {
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
    
    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }
    
    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()
      
      if (timeLeft <= 0) {
        return clearInterval(interval)
      }
      
      const particleCount = 50 * (timeLeft / duration)
      
      // Создаём конфетти слева
      createConfettiPiece(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
      )
      // Создаём конфетти справа
      createConfettiPiece(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
      )
    }, 250)
  }
  
  // Создание конфетти (простая реализация)
  const createConfettiPiece = (options: any) => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
    
    for (let i = 0; i < options.particleCount; i++) {
      const confetti = document.createElement('div')
      confetti.style.position = 'fixed'
      confetti.style.width = '10px'
      confetti.style.height = '10px'
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      confetti.style.left = (options.origin.x * window.innerWidth) + 'px'
      confetti.style.top = (options.origin.y * window.innerHeight) + 'px'
      confetti.style.opacity = '1'
      confetti.style.zIndex = '9999'
      confetti.style.pointerEvents = 'none'
      
      document.body.appendChild(confetti)
      
      const angle = Math.random() * Math.PI * 2
      const velocity = options.startVelocity * (0.5 + Math.random() * 0.5)
      const vx = Math.cos(angle) * velocity
      const vy = Math.sin(angle) * velocity
      
      let x = parseFloat(confetti.style.left)
      let y = parseFloat(confetti.style.top)
      let opacity = 1
      
      const animate = () => {
        y += vy
        x += vx
        opacity -= 0.02
        
        confetti.style.left = x + 'px'
        confetti.style.top = y + 'px'
        confetti.style.opacity = opacity.toString()
        
        if (opacity > 0) {
          requestAnimationFrame(animate)
        } else {
          confetti.remove()
        }
      }
      
      requestAnimationFrame(animate)
    }
  }
  
  // Удалить проект
  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    
    const confirmed = await confirm({
      title: t('projects:confirm.deleteTitle'),
      message: t('projects:confirm.deleteMessage', { title: project.title }),
      confirmText: t('actions.delete'),
      variant: 'danger'
    })
    if (!confirmed) return

    const deleted = projects.find(p => p.id === projectId)
    await deleteProject(projectId)
    await loadProjects()
    if (deleted) {
      showToast(t('common:undo.projectDeleted'), 'info', {
        action: {
          label: t('common:undo.action'),
          onAction: async () => {
            await saveProject(deleted)
            await loadProjects()
          }
        }
      })
    }
  }
  
  // Разморозить проект
  const handleUnfreezeProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const unfreezeCount = project.unfreezeCount || 0

    const confirmed = await confirm({
      title: t('projects:confirm.unfreezeTitle'),
      message: t('projects:confirm.unfreezeMessage', { title: project.title }),
      confirmText: t('projects:confirm.unfreezeConfirm'),
      variant: 'info'
    })
    if (!confirmed) return

    const updatedProject: Project = {
      ...project,
      status: 'active',
      completedDate: undefined,
      unfreezeCount: unfreezeCount + 1
    }

    await saveProject(updatedProject)
    await loadProjects()
  }

  const activeProjects = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const pausedProjects = projects.filter(p => p.status === 'paused')
  
  return (
    <div className="max-w-6xl mx-auto">
      {/* Заголовок */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              📚 {t('projects:page.title')}
              <HelpTip text={t('common:help.projects')} />
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('projects:page.subtitle', { active: activeProjects.length, completed: completedProjects.length })}{pausedProjects.length > 0 ? t('projects:page.subtitlePaused', { paused: pausedProjects.length }) : ''}
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            + {t('projects:page.createProject')}
          </button>
        </div>
      </div>
      
      {/* Форма создания/редактирования */}
      {(isCreating || editingId) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            {isCreating ? t('projects:page.createProject') : t('projects:page.editProject')}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects:form.titleLabel')}
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('projects:form.titlePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('projects:form.genreLabel')}
                </label>
                <select
                  value={formGenre}
                  onChange={(e) => setFormGenre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                  {genres.map(genre => (
                    <option key={genre.id} value={genre.id}>{getGenreLabel(genre.id)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('projects:form.targetLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  placeholder={t('projects:form.targetPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
            </div>
            
            {/* Памятка средних объёмов книг */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 dark:text-white mb-3">📊 {t('projects:form.volumesTitle')}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  <span className="text-gray-700 dark:text-gray-300">{t('projects:form.volumeStory')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📖</span>
                  <span className="text-gray-700 dark:text-gray-300">{t('projects:form.volumeNovella')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📚</span>
                  <span className="text-gray-700 dark:text-gray-300">{t('projects:form.volumeNovel')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📕</span>
                  <span className="text-gray-700 dark:text-gray-300">{t('projects:form.volumeEpic')}</span>
                </div>
              </div>
              {formGenre && getGenreHint(formGenre) && (
                <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-600">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    {getGenreHint(formGenre)}
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects:form.deadlineLabel')}
              </label>
              <input
                type="date"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects:form.phaseLabel')}
              </label>
              <select
                value={formPhase}
                onChange={(e) => setFormPhase(e.target.value as 'draft' | 'revision')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="draft">{t('projects:form.phaseDraft')}</option>
                <option value="revision">{t('projects:form.phaseRevision')}</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('projects:form.phaseHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('projects:form.descriptionLabel')}
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('projects:form.descriptionPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                rows={3}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={isCreating ? createProject : updateProject}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                {isCreating ? t('actions.create') : t('actions.save')}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setEditingId(null)
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                {t('actions.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Активные проекты */}
      {activeProjects.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            {t('projects:page.activeProjects')}
          </h2>
          <div className="grid gap-4">
            {activeProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={openEditForm}
                onDelete={handleDeleteProject}
                onComplete={completeProject}
                onReplan={replanProject}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Завершённые проекты */}
      {completedProjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            {t('projects:page.completedProjects', { count: completedProjects.length })}
          </h2>
          <div className="grid gap-4">
            {completedProjects.map(project => (
              <CompletedProjectCard
                key={project.id}
                project={project}
                onUnfreeze={handleUnfreezeProject}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Приостановленные проекты */}
      {pausedProjects.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            ⏸️ {t('projects:page.pausedProjects', { count: pausedProjects.length })}
          </h2>
          <div className="grid gap-4">
            {pausedProjects.map(project => (
              <CompletedProjectCard
                key={project.id}
                project={project}
                onUnfreeze={handleUnfreezeProject}
              />
            ))}
          </div>
        </div>
      )}

      {/* Пусто */}
      {projects.length === 0 && !isCreating && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('projects:page.empty')}
          </p>
          <button
            onClick={openCreateForm}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            + {t('projects:page.createProject')}
          </button>
        </div>
      )}
      
      {/* Модалка завершения проекта */}
      <ProjectCompletionModal
        isOpen={showCompletionModal}
        onClose={() => {
          setShowCompletionModal(false)
          setCompletedProject(null)
          setCompletionMilestoneData(null)
        }}
        project={completedProject}
        milestoneData={completionMilestoneData}
        onCreateNewProject={() => {
          setIsCreating(true)
        }}
      />
    </div>
  )
}

export default ProjectsPage