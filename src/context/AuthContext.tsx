import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '../types'
import { get, post } from '../utils/api'

interface Notification {
  id: number
  title: string
  message: string
  type: string
  is_read: boolean
  priority: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  updateUser: (user: User) => void
  notifications: Notification[]
  unreadCount: number
  setNotifications: (notifications: Notification[]) => void
  markNotificationRead: (id: number) => void
  refreshNotifications: () => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
  isLocked: boolean
  lockStation: () => void
  unlockStation: (passwordOrPin: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return localStorage.getItem('station_locked') === 'true'
  })

  const fetchNotifications = useCallback(async () => {
    const currentToken = localStorage.getItem('token')
    if (!currentToken) return
    try {
      const res = await get<any>('/notifications?limit=25')
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications)
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      fetchNotifications()
    }
    setIsLoading(false)
  }, [fetchNotifications])

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    localStorage.removeItem('station_locked')
    setToken(newToken)
    setUser(newUser)
    setIsLocked(false)
    fetchNotifications()
  }, [fetchNotifications])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('station_locked')
    setToken(null)
    setUser(null)
    setIsLocked(false)
    setNotifications([])
  }, [])

  const lockStation = useCallback(() => {
    localStorage.setItem('station_locked', 'true')
    setIsLocked(true)
  }, [])

  const unlockStation = useCallback(async (passwordOrPin: string) => {
    if (!user) return { success: false, error: 'No active session' }
    try {
      const isPinOnly = /^\d{4,6}$/.test(passwordOrPin.trim())
      const res = await post<any>('/auth/unlock', {
        user_id: user.id,
        password: passwordOrPin,
        pin: isPinOnly ? passwordOrPin.trim() : undefined,
      })
      if (res && res.token && res.user) {
        localStorage.setItem('token', res.token)
        localStorage.setItem('user', JSON.stringify(res.user))
        localStorage.removeItem('station_locked')
        setToken(res.token)
        setUser(res.user)
        setIsLocked(false)
        return { success: true }
      }
      return { success: false, error: res?.error || 'Invalid credentials' }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to unlock station' }
    }
  }, [user])

  const updateUser = useCallback((updatedUser: User) => {
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }, [])

  const markNotificationRead = useCallback((id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    )
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUser,
        notifications,
        unreadCount,
        setNotifications,
        markNotificationRead,
        refreshNotifications: fetchNotifications,
        isAuthenticated: !!token && !!user,
        isLoading,
        isLocked,
        lockStation,
        unlockStation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
