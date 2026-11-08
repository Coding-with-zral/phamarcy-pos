import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Bot,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Pill,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
  roles?: string[]
  mobileOnly?: boolean
}

const primaryItems: NavigationItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'POS', path: '/pos', icon: ShoppingCart },
  { label: 'Inventory', path: '/inventory', icon: Package },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Prescriptions', path: '/prescriptions', icon: FileText },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
]

const moreItems: NavigationItem[] = [
  { label: 'Customers', path: '/customers', icon: Users, mobileOnly: true },
  { label: 'Suppliers', path: '/suppliers', icon: Truck },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Bot },
  { label: 'Employees', path: '/employees', icon: UserCog, roles: ['admin', 'pharmacist'] },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
]

export default function POSNavigation() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const visibleMoreItems = moreItems.filter(item => !item.roles || (user && item.roles.includes(user.role)))
  const moreActive = visibleMoreItems.some(item => item.path === location.pathname)
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-100 text-emerald-900'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="relative z-40 shrink-0 border-b border-slate-200 bg-white shadow-sm">
      <div className="flex h-12 items-center justify-between px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Pill size={18} />
          </span>
          <span className="truncate text-sm font-bold text-slate-900 sm:text-base">Hauzral Pharmacy</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-right sm:block">
            <span className="block max-w-36 truncate text-xs font-semibold text-slate-800">{user?.full_name}</span>
            <span className="block text-[10px] capitalize text-slate-500">{user?.role}</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
            aria-label="Sign out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-2 py-1.5 sm:px-4">
        {primaryItems.map((item, index) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `${navLinkClass({ isActive })} ${index > 2 ? 'hidden md:flex' : ''}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}

        {visibleMoreItems.length > 0 && (
          <div className="relative ml-auto shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen(open => !open)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                moreOpen || moreActive ? 'bg-emerald-100 text-emerald-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              More
            </button>
            {moreOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {visibleMoreItems.map(item => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `${item.mobileOnly ? 'md:hidden ' : ''}flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          isActive ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                        }`
                      }
                    >
                      <Icon size={17} />
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
