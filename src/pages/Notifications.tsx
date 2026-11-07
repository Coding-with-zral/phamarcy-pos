import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Clock,
  Package,
  Filter,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { get, put } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import type { Notification } from '../types'

type FilterTab = 'all' | 'unread' | 'low_stock' | 'expiry'

function timeAgo(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return then.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'low_stock', label: 'Low Stock' },
  { key: 'expiry', label: 'Expiry' },
]

function getTypeIcon(type: string) {
  switch (type) {
    case 'low_stock':
    case 'inventory':
      return <Package className="w-4 h-4" />
    case 'expiry':
      return <Clock className="w-4 h-4" />
    case 'sale':
      return <CheckCircle2 className="w-4 h-4" />
    case 'system':
      return <Info className="w-4 h-4" />
    default:
      return <Bell className="w-4 h-4" />
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'low_stock':
    case 'inventory':
      return 'bg-amber-100 text-amber-700'
    case 'expiry':
      return 'bg-red-100 text-red-600'
    case 'sale':
      return 'bg-emerald-100 text-emerald-700'
    case 'system':
      return 'bg-blue-100 text-blue-600'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'critical':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Critical</span>
    case 'high':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">High</span>
    case 'normal':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Normal</span>
    default:
      return null
  }
}

export default function Notifications() {
  const { notifications, setNotifications, markNotificationRead } = useAuth()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await get<{ notifications: Notification[] }>('/notifications')
      setNotifications(res.notifications || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [setNotifications])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAsRead = async (id: number) => {
    try {
      await put(`/api/notifications/${id}/read`)
      markNotificationRead(id)
    } catch {
      toast.error('Failed to mark notification as read')
    }
  }

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read)
    if (unread.length === 0) return
    try {
      await Promise.all(unread.map((n) => put(`/api/notifications/${n.id}/read`)))
      unread.forEach((n) => markNotificationRead(n.id))
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark notifications as read')
    }
  }

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.is_read
    if (activeTab === 'low_stock') return n.type === 'low_stock'
    if (activeTab === 'expiry') return n.type === 'expiry'
    return true
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {filterTabs.map((tab) => {
          const count = tab.key === 'all'
            ? notifications.length
            : tab.key === 'unread'
            ? unreadCount
            : notifications.filter((n) => n.type === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${
                  activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16">
          <div className="bg-gray-100 rounded-full p-6 mb-4">
            <Inbox className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'unread' ? "You're all caught up!" : 'No notifications in this category.'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((notification, i) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                  notification.is_read
                    ? 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getTypeColor(notification.type)}`}>
                  {getTypeIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm ${notification.is_read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>
                          {notification.title}
                        </h4>
                        {getPriorityBadge(notification.priority)}
                        {!notification.is_read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(notification.created_at)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
