import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Header from './Header'
import StationLockScreen from './StationLockScreen'

export default function Layout() {
  const { isAuthenticated, isLoading, isLocked } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const handleToggleDesktop = () => {
    setSidebarCollapsed(prev => !prev)
  }

  const handleToggleMobile = () => {
    setMobileOpen(prev => !prev)
  }

  const handleMobileOverlayClick = () => {
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleDesktop} />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={handleMobileOverlayClick}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full z-50 lg:hidden transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar collapsed={false} onToggle={handleToggleMobile} />
      </div>

      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        }`}
      >
        <Header onToggleSidebar={handleToggleMobile} />

        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {isLocked && <StationLockScreen />}
    </div>
  )
}
