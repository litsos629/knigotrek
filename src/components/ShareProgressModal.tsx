import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { dfnsLocale, intlLocale } from '../i18n/dateLocale'
import { useToast } from './Toast'
import { escapeHtml } from '../services/reports/reportUtils'

interface ShareProgressModalProps {
  isOpen: boolean
  onClose: () => void
  template: 'week' | 'session' | 'streak' | 'completion'
  data?: {
    entries?: Array<{ date: string; symbols: number }>
    sessions?: Array<{ date: string; duration: number; symbols: number; speed: number }>
    streak?: number
    totalSymbols?: number
    projectTitle?: string
  }
}

function ShareProgressModal({ isOpen, onClose, template, data }: ShareProgressModalProps) {
  const { t } = useTranslation()
  const [selectedFormat, setSelectedFormat] = useState<'image' | 'pdf' | 'text'>('image')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  if (!isOpen) return null

  const handleGenerateImage = async () => {
    setIsGenerating(true)
    setError(null)
    // Объявлен вне try: finally должен убрать контейнер из DOM и при ошибке html2canvas
    let container: HTMLDivElement | null = null
    try {
      container = document.createElement('div')
      container.style.width = '1080px'
      container.style.height = '1080px'
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.background = 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)'
      container.style.padding = '60px'
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
      container.style.color = '#ffffff'
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.justifyContent = 'space-between'
      container.style.boxSizing = 'border-box'

      let content = ''
      
      if (template === 'week' && data) {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
        const weekSymbols = data.entries?.reduce((sum, e) => {
          const entryDate = new Date(e.date)
          return entryDate >= weekStart && entryDate <= weekEnd ? sum + e.symbols : sum
        }, 0) || 0
        
        content = `
          <div style="text-align: center;">
            <div style="font-size: 72px; font-weight: bold; margin-bottom: 20px;">${t('reports:shareModal.image.weekTitle')}</div>
            <div style="font-size: 36px; opacity: 0.9; margin-bottom: 60px;">
              ${format(weekStart, 'd MMM', { locale: dfnsLocale() })} - ${format(weekEnd, 'd MMM yyyy', { locale: dfnsLocale() })}
            </div>
          </div>

          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 40px; text-align: center;">
            <div style="font-size: 64px; font-weight: bold;">
              <span style="font-size: 80px;">✍️</span> ${weekSymbols.toLocaleString(intlLocale())} ${t('reports:shareModal.image.symbols')}
            </div>
            ${data.streak ? `<div style="font-size: 56px; font-weight: bold;">
              <span style="font-size: 72px;">🔥</span> ${data.streak} ${t('reports:shareModal.image.streakDays')}
            </div>` : ''}
            <div style="font-size: 48px; opacity: 0.9;">
              ${data.entries?.length || 0} ${t('reports:shareModal.image.workDays')}
            </div>
          </div>
        `
      } else if (template === 'streak' && data?.streak) {
        content = `
          <div style="text-align: center;">
            <div style="font-size: 96px; font-weight: bold; margin-bottom: 30px;">🔥</div>
            <div style="font-size: 64px; font-weight: bold; margin-bottom: 20px;">${t('reports:shareModal.image.streakAchievement')}</div>
            <div style="font-size: 48px; opacity: 0.9; margin-bottom: 60px;">
              ${data.streak} ${t('reports:shareModal.image.streakDays')}
            </div>
          </div>

          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 30px; text-align: center;">
            <div style="font-size: 56px; font-weight: bold;">
              ${t('reports:shareModal.image.keepGoing')}
            </div>
            ${data.totalSymbols ? `<div style="font-size: 48px; opacity: 0.9;">
              ${t('reports:shareModal.image.totalWritten', { value: data.totalSymbols.toLocaleString(intlLocale()) })}
            </div>` : ''}
          </div>
        `
      } else if (template === 'completion' && data) {
        content = `
          <div style="text-align: center;">
            <div style="font-size: 96px; font-weight: bold; margin-bottom: 30px;">🏆</div>
            <div style="font-size: 64px; font-weight: bold; margin-bottom: 20px;">${t('reports:shareModal.image.projectDone')}</div>
            ${data.projectTitle ? `<div style="font-size: 48px; opacity: 0.9; margin-bottom: 60px;">
              "${escapeHtml(data.projectTitle)}"
            </div>` : ''}
          </div>

          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 30px; text-align: center;">
            ${data.totalSymbols ? `<div style="font-size: 56px; font-weight: bold;">
              ✍️ ${data.totalSymbols.toLocaleString(intlLocale())} ${t('reports:shareModal.image.symbols')}
            </div>` : ''}
            <div style="font-size: 48px; opacity: 0.9;">
              ${t('reports:shareModal.image.hugeAchievement')}
            </div>
          </div>
        `
      } else {
        // По умолчанию - неделя
        content = `
          <div style="text-align: center;">
            <div style="font-size: 72px; font-weight: bold; margin-bottom: 20px;">${t('reports:shareModal.image.myProgress')}</div>
            <div style="font-size: 36px; opacity: 0.9; margin-bottom: 60px;">
              ${format(new Date(), 'd MMMM yyyy', { locale: dfnsLocale() })}
            </div>
          </div>

          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 40px; text-align: center;">
            ${data?.totalSymbols ? `<div style="font-size: 64px; font-weight: bold;">
              <span style="font-size: 80px;">✍️</span> ${data.totalSymbols.toLocaleString(intlLocale())} ${t('reports:shareModal.image.symbols')}
            </div>` : ''}
            ${data?.streak ? `<div style="font-size: 56px; font-weight: bold;">
              <span style="font-size: 72px;">🔥</span> ${data.streak} ${t('reports:shareModal.image.streakDays')}
            </div>` : ''}
          </div>
        `
      }

      container.innerHTML = content + `
        <div style="text-align: center; font-size: 28px; opacity: 0.8;">
          <div>${t('reports:shareModal.brand')}</div>
          <div style="margin-top: 10px;">${t('reports:shareModal.site')}</div>
        </div>
      `

      document.body.appendChild(container)

      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(container, {
        width: 1080,
        height: 1080,
        scale: 1,
        backgroundColor: null
      })

      const dataUrl = canvas.toDataURL('image/png')

      // Скачиваем или делимся
      if (navigator.share) {
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], `knigotrek-${template}-${format(new Date(), 'yyyy-MM-dd')}.png`, {
          type: 'image/png'
        })
        await navigator.share({
          title: t('reports:shareModal.shareTitle'),
          files: [file]
        })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `knigotrek-${template}-${format(new Date(), 'yyyy-MM-dd')}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      setError(t('reports:shareModal.errorImage'))
      console.error(err)
    } finally {
      if (container?.parentNode) container.parentNode.removeChild(container)
      setIsGenerating(false)
    }
  }

  const handleGeneratePDF = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      // Для PDF используем существующие функции
      if (template === 'session' && data?.sessions && data.sessions.length > 0) {
        const lastSession = data.sessions[data.sessions.length - 1]
        const sessionData = {
          id: 'share',
          date: lastSession.date,
          duration: lastSession.duration,
          plannedDuration: lastSession.duration,
          symbols: lastSession.symbols,
          speed: lastSession.speed,
          projectTitle: data.projectTitle
        }
        const { generateSessionMicroReport } = await import('../services/pdfService')
        const doc = await generateSessionMicroReport(sessionData)
        doc.save(`knigotrek-${template}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
      } else {
        // Для других шаблонов создаем простой PDF (+ регистрация шрифтов Roboto)
        await import('../services/pdfFontSetup')
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })

        doc.setFillColor(79, 70, 229)
        doc.rect(0, 0, 210, 50, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(24)
        doc.setFont('Roboto', 'bold')

        if (template === 'week') {
          doc.text(t('reports:shareModal.pdf.weekTitle'), 105, 25, { align: 'center' })
        } else if (template === 'streak') {
          doc.text(t('reports:shareModal.pdf.streakTitle'), 105, 25, { align: 'center' })
        } else if (template === 'completion') {
          doc.text(t('reports:shareModal.pdf.completionTitle'), 105, 25, { align: 'center' })
        }

        doc.setTextColor(17, 24, 39)
        doc.setFont('Roboto', 'normal')
        let yPos = 70

        if (data?.totalSymbols) {
          doc.setFontSize(16)
          doc.text(t('reports:shareModal.pdf.written', { value: data.totalSymbols.toLocaleString(intlLocale()) }), 20, yPos)
          yPos += 15
        }

        if (data?.streak) {
          doc.setFontSize(16)
          doc.text(t('reports:shareModal.pdf.streak', { value: data.streak }), 20, yPos)
          yPos += 15
        }

        doc.setFontSize(10)
        doc.setTextColor(107, 114, 128)
        doc.text(t('reports:shareModal.pdf.madeIn'), 105, 270, { align: 'center' })
        doc.text(t('reports:shareModal.pdf.footer', { year: new Date().getFullYear() }), 105, 276, { align: 'center' })

        doc.save(`knigotrek-${template}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
      }
    } catch (err) {
      setError(t('reports:shareModal.errorPdf'))
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyText = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      let text = ''
      
      if (template === 'week' && data) {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
        const weekSymbols = data.entries?.reduce((sum, e) => {
          const entryDate = new Date(e.date)
          return entryDate >= weekStart && entryDate <= weekEnd ? sum + e.symbols : sum
        }, 0) || 0
        
        text = `${t('reports:shareModal.text.weekTitle')}\n`
        text += `${t('reports:shareModal.text.written', { value: weekSymbols.toLocaleString(intlLocale()) })}\n`
        if (data.streak) {
          text += `${t('reports:shareModal.text.streak', { value: data.streak })}\n`
        }
        text += `\n${t('reports:shareModal.text.writeIn')}`
      } else if (template === 'streak' && data?.streak) {
        text = `${t('reports:shareModal.text.streakTitle')}\n\n`
        text += `${t('reports:shareModal.text.streakDays', { value: data.streak })}\n\n`
        if (data.totalSymbols) {
          text += `${t('reports:shareModal.text.totalWritten', { value: data.totalSymbols.toLocaleString(intlLocale()) })}\n\n`
        }
        text += `${t('reports:shareModal.text.writeIn')}`
      } else if (template === 'completion' && data) {
        text = `${t('reports:shareModal.text.completionTitle')}\n\n`
        if (data.projectTitle) {
          text += `"${data.projectTitle}"\n\n`
        }
        if (data.totalSymbols) {
          text += `${t('reports:shareModal.text.completionWritten', { value: data.totalSymbols.toLocaleString(intlLocale()) })}\n\n`
        }
        text += `${t('reports:shareModal.text.hugeAchievement')}\n\n`
        text += `${t('reports:shareModal.text.completionBrand')}`
      } else {
        text = `${t('reports:shareModal.text.myProgress')}\n\n`
        if (data?.totalSymbols) {
          text += `${t('reports:shareModal.text.written', { value: data.totalSymbols.toLocaleString(intlLocale()) })}\n`
        }
        if (data?.streak) {
          text += `${t('reports:shareModal.text.streak', { value: data.streak })}\n`
        }
        text += `\n${t('reports:shareModal.text.writeIn')}`
      }

      await navigator.clipboard.writeText(text)
      showToast(t('reports:shareModal.textCopied'), 'success')
    } catch (err) {
      setError(t('reports:shareModal.errorText'))
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleShare = async () => {
    if (selectedFormat === 'image') {
      await handleGenerateImage()
    } else if (selectedFormat === 'pdf') {
      await handleGeneratePDF()
    } else if (selectedFormat === 'text') {
      await handleCopyText()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          📱 {t('reports:share.title')}
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('reports:shareModal.selectFormat')}
            </label>
            <div className="space-y-2">
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      value="image"
                      checked={selectedFormat === 'image'}
                      onChange={(e) => setSelectedFormat(e.target.value as 'image')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">🖼️ {t('reports:shareModal.imageLabel')}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{t('reports:shareModal.imageDesc')}</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      value="pdf"
                      checked={selectedFormat === 'pdf'}
                      onChange={(e) => setSelectedFormat(e.target.value as 'pdf')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">📄 {t('reports:shareModal.pdfLabel')}</div>
                    </div>
                  </label>
                </div>

              <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  value="text"
                  checked={selectedFormat === 'text'}
                  onChange={(e) => setSelectedFormat(e.target.value as 'text')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">📋 {t('reports:shareModal.textLabel')}</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleShare}
            disabled={isGenerating}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? t('reports:shareModal.generating') : t('reports:shareModal.shareButton')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            {t('actions.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShareProgressModal
