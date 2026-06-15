import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
}

function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { t } = useTranslation()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const menuItems = [
    { id: 'home', icon: '🏠' },
    { id: 'projects', icon: '📚' },
    { id: 'notes', icon: '📝' },
    { id: 'focus', icon: '🕐' },
    { id: 'reports', icon: '📄' },
    { id: 'sync', icon: '🔄' },
    { id: 'settings', icon: '⚙️' },
  ]

  const handleNavigate = (page: string) => {
    onNavigate(page)
    setIsMobileOpen(false)
  }

  const sidebarContent = (
    <div className="w-64 bg-indigo-700 dark:bg-indigo-900 text-white min-h-screen p-6 flex flex-col">
      <h2 className="text-2xl font-bold mb-8">{t('appName')}</h2>

      <nav className="space-y-4 flex-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={`w-full text-left px-4 py-2 rounded transition ${
              currentPage === item.id
                ? 'bg-indigo-800 dark:bg-indigo-800 font-bold'
                : 'hover:bg-indigo-600 dark:hover:bg-indigo-700'
            }`}
          >
            {item.icon} {t(`nav.${item.id}`)}
          </button>
        ))}
      </nav>

    </div>
  )

  return (
    <>
      {/* Hamburger button — only on mobile */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden bg-indigo-700 text-white w-10 h-10 rounded-lg flex items-center justify-center shadow-lg text-xl"
        aria-label={t('openMenu')}
      >
        ☰
      </button>

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex flex-col">
        {sidebarContent}
      </div>

      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar — shown as overlay when open */}
      {isMobileOpen && (
        <div className="fixed inset-y-0 left-0 z-40 flex flex-col md:hidden">
          {sidebarContent}
        </div>
      )}
    </>
  )
}

export default Sidebar
