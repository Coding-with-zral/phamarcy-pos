import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  FileText,
  BarChart3,
  Bot,
  UserCog,
  Settings,
  Bell,
  Pill,
  LogOut,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

import { useState, useEffect } from 'react'
import { get } from '../utils/api'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  roles?: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'POS', path: '/pos', icon: ShoppingCart },
  { label: 'Inventory', path: '/inventory', icon: Package },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Suppliers', path: '/suppliers', icon: Truck },
  { label: 'Prescriptions', path: '/prescriptions', icon: FileText },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Bot },
  { label: 'Employees', path: '/employees', icon: UserCog, roles: ['admin', 'pharmacist'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
  { label: 'Notifications', path: '/notifications', icon: Bell },
]

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout, unreadCount } = useAuth()
  const navigate = useNavigate()
  const [lowStockCount, setLowStockCount] = useState<number>(0)

  useEffect(() => {
    const fetchAlertSummary = async () => {
      try {
        const res = await get<any>('/inventory/summary')
        if (res && typeof res.low_stock_count === 'number') {
          setLowStockCount(res.low_stock_count)
        }
      } catch {
        // silent
      }
    }
    fetchAlertSummary()
    const interval = setInterval(fetchAlertSummary, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredItems = navItems.filter(item => {
    if (!item.roles) return true
    return user && item.roles.includes(user.role)
  })

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-emerald-900 text-white z-40 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-emerald-800">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Pill size={18} className="text-white" />
            </div>
            <span className="font-bold text-sm whitespace-nowrap truncate">
              Hauzral Pharmacy POS
            </span>
          </div>
        )}
        {collapsed && (
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mx-auto">
            <Pill size={18} className="text-white" />
          </div>
        )}
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md hover:bg-emerald-800 transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {filteredItems.map(item => {
          const Icon = item.icon
          const isInventory = item.path === '/inventory'
          const isNotifications = item.path === '/notifications'
          const hasInventoryAlert = isInventory && lowStockCount > 0
          const hasNotificationAlert = isNotifications && unreadCount > 0

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <div className="relative flex-shrink-0">
                <Icon size={20} />
                {collapsed && hasInventoryAlert && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-emerald-900 animate-pulse" />
                )}
                {collapsed && hasNotificationAlert && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-400 rounded-full border border-emerald-900" />
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="truncate flex-1">{item.label}</span>
                  {hasInventoryAlert && (
                    <span
                      title={`${lowStockCount} items low in stock or depleted`}
                      className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-emerald-950 flex items-center gap-1 shadow-sm"
                    >
                      <span>⚠</span>
                      <span>{lowStockCount}</span>
                    </span>
                  )}
                  {hasNotificationAlert && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-emerald-800 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-emerald-300 capitalize truncate">{user.role}</p>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="flex justify-center mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-100 hover:bg-emerald-800 hover:text-white transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
