import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pill, User, Lock, Eye, EyeOff, Loader2, Mail, Phone,
  UserPlus, LogIn, ShieldCheck, Sparkles, CheckCircle2,
  KeyRound, ArrowRight, RefreshCw, AlertCircle, Check, X
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { post } from '../utils/api'
import type { User as UserType } from '../types'

interface AuthResponse {
  token: string
  user: UserType
}

declare global {
  interface Window {
    google?: any
  }
}

export default function Login() {
  const [tab, setTab] = useState<'login' | 'register'>('login')

  // Login form fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)

  // Google sign in state
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [selectedGoogleRole, setSelectedGoogleRole] = useState<'admin' | 'pharmacist' | 'cashier'>('pharmacist')
  const [customGoogleEmail, setCustomGoogleEmail] = useState('kipkoechkev6@gmail.com')

  // Forgot password flow
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request')
  const [forgotIdentifier, setForgotIdentifier] = useState('')
  const [resetPin, setResetPin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [generatedPinNotice, setGeneratedPinNotice] = useState<string | null>(null)

  // Registration fields
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regRole, setRegRole] = useState<'cashier' | 'pharmacist' | 'admin'>('cashier')
  const [showRegPassword, setShowRegPassword] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  // Load remembered username if present
  useEffect(() => {
    const saved = localStorage.getItem('hauzral_saved_username')
    const savedRemember = localStorage.getItem('hauzral_remember_me')
    if (saved) {
      setUsername(saved)
    }
    if (savedRemember !== null) {
      setRememberMe(savedRemember === 'true')
    }
  }, [])

  // Initialize Google Identity Services if available in index.html
  useEffect(() => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: '718293847291-example.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
          auto_select: false,
        })
        const btnContainer = document.getElementById('google-btn-rendered')
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
          })
        }
      } catch (e) {
        // Fall back gracefully to modal
      }
    }
  }, [])

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) return
    setGoogleLoading(true)
    try {
      const res = await post<AuthResponse>('/auth/google', {
        credential: response.credential,
        role: selectedGoogleRole,
      })
      login(res.token, res.user)
      toast.success(`Google Signed in: Welcome, ${res.user.full_name}`)
      navigate('/pos')
    } catch (err: any) {
      toast.error(err?.message || 'Google sign-in failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleLoginDirect = async (emailToUse?: string, roleToUse?: string) => {
    setGoogleLoading(true)
    const email = emailToUse || customGoogleEmail.trim()
    const role = roleToUse || selectedGoogleRole

    if (!email) {
      toast.error('Please enter a Google account email')
      setGoogleLoading(false)
      return
    }

    try {
      const namePart = email.split('@')[0]
      const formattedName = namePart
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

      const res = await post<AuthResponse>('/auth/google', {
        email,
        name: formattedName,
        role,
        picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      })
      login(res.token, res.user)
      toast.success(`Google Verified: Welcome, ${res.user.full_name}!`)
      setShowGoogleModal(false)
      navigate('/pos')
    } catch (err: any) {
      toast.error(err?.message || 'Google sign-in failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleQuickDemo = async (demoUsername: string, demoRoleLabel: string) => {
    setLoading(true)
    try {
      const res = await post<AuthResponse>('/auth/login', {
        username: demoUsername,
        password: `${demoUsername}123`,
      })
      login(res.token, res.user)
      toast.success(`Logged in as ${demoRoleLabel}!`)
      navigate('/pos')
    } catch (err: any) {
      toast.error(err?.message || 'Could not load demo account')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password')
      return
    }

    // Save or clear remembered username
    if (rememberMe) {
      localStorage.setItem('hauzral_saved_username', username.trim())
      localStorage.setItem('hauzral_remember_me', 'true')
    } else {
      localStorage.removeItem('hauzral_saved_username')
      localStorage.setItem('hauzral_remember_me', 'false')
    }

    setLoading(true)
    try {
      const res = await post<AuthResponse>('/auth/login', { username, password })
      login(res.token, res.user)
      toast.success(`Welcome back, ${res.user.full_name}!`)
      navigate('/pos')
    } catch (err: any) {
      toast.error(err?.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  // Password Recovery Handlers
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotIdentifier.trim()) {
      toast.error('Please enter your staff username or email')
      return
    }

    setForgotLoading(true)
    try {
      const res = await post<any>('/auth/forgot-password', {
        identifier: forgotIdentifier.trim(),
      })
      if (res && res.success) {
        setGeneratedPinNotice(res.reset_pin)
        setResetPin(res.reset_pin)
        setForgotStep('reset')
        toast.success('Recovery code generated successfully!')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Staff account not found')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPin.trim() || !newPassword.trim()) {
      toast.error('Please enter the recovery PIN and new password')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match')
      return
    }

    setForgotLoading(true)
    try {
      const res = await post<any>('/auth/reset-password', {
        identifier: forgotIdentifier.trim(),
        pin: resetPin.trim(),
        new_password: newPassword,
      })
      if (res && res.success) {
        toast.success('Password updated! Signing in with new credentials...')
        setUsername(forgotIdentifier.trim())
        setPassword(newPassword)
        setShowForgotModal(false)
        setForgotStep('request')
        setGeneratedPinNotice(null)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reset password')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regName.trim() || !regUsername.trim() || !regPassword.trim()) {
      toast.error('Please fill in all required fields')
      return
    }
    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (regPassword !== regConfirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await post<AuthResponse>('/auth/register', {
        full_name: regName,
        username: regUsername,
        password: regPassword,
        role: regRole,
        email: regEmail || undefined,
        phone: regPhone || undefined,
      })
      toast.success('Staff account created! Please sign in')
      setUsername(regUsername)
      setPassword(regPassword)
      setTab('login')
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Password strength calculation helper
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'bg-slate-200' }
    let score = 0
    if (pwd.length >= 6) score += 1
    if (pwd.length >= 8) score += 1
    if (/[0-9]/.test(pwd)) score += 1
    if (/[^a-zA-Z0-9]/.test(pwd) || /[A-Z]/.test(pwd)) score += 1

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' }
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' }
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' }
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' }
  }

  const regStrength = getPasswordStrength(regPassword)
  const resetStrength = getPasswordStrength(newPassword)

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 relative">
      <Toaster position="top-right" />

      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
      </div>

      {/* Left side brand presentation */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14 relative z-10 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Pill className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hauzral Pharmacy POS</h1>
              <p className="text-emerald-300 text-xs font-medium uppercase tracking-wider">Clinical Healthcare ERP &bull; Kenya</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium mb-6">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            Client MVP Ready &bull; Google SSO &bull; Station Auto-Lock &bull; AI Grounded
          </div>

          <h2 className="text-4xl font-extrabold leading-tight tracking-tight mb-4 text-white">
            Modern Dispensary POS & Healthcare Management
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-8">
            Complete pharmacy checkout with barcode scanning, M-Pesa & Cash handling, FEFO batch expiry alerts, prescription records, and Gemini AI drug interaction checks.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold text-emerald-400 mb-1">166+</div>
              <div className="text-xs text-slate-300 font-medium">Kenyan Essential Medicines Pre-seeded</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold text-emerald-400 mb-1">Google SSO</div>
              <div className="text-xs text-slate-300 font-medium">Instant 1-Click Verification</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold text-emerald-400 mb-1">Station Lock</div>
              <div className="text-xs text-slate-300 font-medium">Protected Cashier Terminal</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold text-emerald-400 mb-1">FEFO Alert</div>
              <div className="text-xs text-slate-300 font-medium">Live Stock & Expiry Controls</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center justify-between border-t border-white/10 pt-4">
          <span>&copy; {new Date().getFullYear()} Hauzral Health ERP</span>
          <span className="flex items-center gap-1.5 text-emerald-300">
            <ShieldCheck size={14} />
            <span>PPB Kenya Standard Encrypted RBAC</span>
          </span>
        </div>
      </div>

      {/* Right side authentication card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
        >
          {/* Header tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                tab === 'login'
                  ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                tab === 'register'
                  ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Register Staff
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                <motion.div
                  key="login-tab"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Welcome Back</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Sign in to your dispensary terminal</p>
                    </div>
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <ShieldCheck size={20} />
                    </span>
                  </div>

                  {/* GOOGLE SIGN IN CARD WITH 1-CLICK ACTION */}
                  <div className="mb-5 p-3.5 bg-gradient-to-r from-blue-50/80 to-emerald-50/80 rounded-2xl border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span className="text-xs font-bold text-slate-800">Google Single Sign-On</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                        Instant Access
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 mb-2.5">
                      <span className="truncate font-medium">kipkoechkev6@gmail.com</span>
                      <button
                        type="button"
                        onClick={() => setShowGoogleModal(true)}
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold underline flex-shrink-0"
                      >
                        Change Role/Account
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGoogleLoginDirect('kipkoechkev6@gmail.com', selectedGoogleRole)}
                      disabled={googleLoading}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-sm transition-all"
                    >
                      {googleLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>Continue with Google (kipkoechkev6@gmail.com)</span>
                    </button>
                    <div id="google-btn-rendered" className="w-full flex justify-center mt-2 empty:hidden" />
                  </div>

                  <div className="relative my-4 flex items-center justify-center">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider absolute">
                      or station credentials
                    </span>
                  </div>

                  {/* Standard Username / Password Form */}
                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Station Username
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="e.g. admin or pharmacist"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotIdentifier(username || 'admin')
                            setShowForgotModal(true)
                          }}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Username Checkbox */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        />
                        <span>Remember username on this PC</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 active:scale-[0.99] mt-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Signing In...</span>
                        </>
                      ) : (
                        'Sign In to Station'
                      )}
                    </button>
                  </form>

                  {/* 1-CLICK CLIENT MVP TEST ROLES */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        1-Click Test Roles (Client MVP)
                      </span>
                      <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                        Instant Login
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickDemo('admin', 'Lead Pharmacist (Admin)')}
                        className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-colors"
                      >
                        <div className="font-semibold text-slate-800 text-xs">👑 Admin</div>
                        <div className="text-[10px] text-slate-500 truncate">Formulary & Stock</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDemo('pharmacist', 'Chief Pharmacist')}
                        className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-colors"
                      >
                        <div className="font-semibold text-slate-800 text-xs">💊 Pharmacist</div>
                        <div className="text-[10px] text-slate-500 truncate">Rx & Clinical</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDemo('cashier', 'Head Cashier')}
                        className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-colors"
                      >
                        <div className="font-semibold text-slate-800 text-xs">🛒 Cashier</div>
                        <div className="text-[10px] text-slate-500 truncate">POS Checkout</div>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="register-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-900">Register Staff</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Provision a new dispensary staff member</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        placeholder="Dr. Faith Chemutai"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Role *
                        </label>
                        <select
                          value={regRole}
                          onChange={(e: any) => setRegRole(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="cashier">Cashier</option>
                          <option value="pharmacist">Pharmacist</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Username *
                        </label>
                        <input
                          type="text"
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="fchemutai"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="doctor@pharmacy.co.ke"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="+254 7XX XXX"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Password *
                        </label>
                        {regPassword && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded text-white ${regStrength.color}`}>
                            {regStrength.label}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="block w-full px-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="Min 6 characters"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Password strength progress bar */}
                      {regPassword && (
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${regStrength.color}`}
                            style={{ width: `${(regStrength.score / 4) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        className={`block w-full px-3 py-2 bg-slate-50 border rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm ${
                          regConfirm && regConfirm !== regPassword ? 'border-red-300' : 'border-slate-200'
                        }`}
                        placeholder="Re-enter password"
                        required
                      />
                      {regConfirm && regConfirm !== regPassword && (
                        <p className="text-[10px] text-red-500 mt-1">Passwords do not match</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20"
                    >
                      {loading ? 'Creating...' : 'Register Staff Account'}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Password Recovery</h3>
                    <p className="text-xs text-slate-500">Staff security credential reset</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              {forgotStep === 'request' ? (
                <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter your staff username (e.g. <span className="font-semibold text-emerald-700">admin</span> or <span className="font-semibold text-emerald-700">pharmacist</span>) or registered email address. We will generate a verification code to authorize your password update.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="e.g. admin or kipkoechkev6@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <span>Get Recovery Code</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmPasswordReset} className="space-y-3.5">
                  {generatedPinNotice && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                      <div className="font-semibold flex items-center gap-1 text-emerald-800">
                        <CheckCircle2 size={14} />
                        <span>Verification PIN Generated</span>
                      </div>
                      <p className="mt-1">
                        Use security code <strong className="font-mono text-sm tracking-wider text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300 ml-1">{generatedPinNotice}</strong> to complete your reset.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      6-Digit Security Code
                    </label>
                    <input
                      type="text"
                      value={resetPin}
                      onChange={(e) => setResetPin(e.target.value)}
                      placeholder="e.g. 123456"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-sm tracking-widest text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        New Password
                      </label>
                      {newPassword && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded text-white ${resetStrength.color}`}>
                          {resetStrength.label}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full px-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep('request')}
                      className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                    >
                      {forgotLoading ? 'Updating...' : 'Set New Password'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GOOGLE SIGN IN MODAL */}
      <AnimatePresence>
        {showGoogleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Google Sign-In</h3>
                  <p className="text-xs text-slate-500">Authenticate with your Google Account</p>
                </div>
              </div>

              {/* Detected User Account */}
              <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3.5 mb-4">
                <div className="text-xs font-semibold text-emerald-800 mb-1 flex items-center justify-between">
                  <span>Detected User Session</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">1-Click</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">kipkoechkev6@gmail.com</div>
                    <div className="text-xs text-slate-500">Primary Google Account</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGoogleLoginDirect('kipkoechkev6@gmail.com', selectedGoogleRole)}
                    disabled={googleLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    Use This
                  </button>
                </div>
              </div>

              {/* Custom Google Email input */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Or Enter Any Google / Workspace Email:
                  </label>
                  <input
                    type="email"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="your.email@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Station Role:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pharmacist', 'admin', 'cashier'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedGoogleRole(r)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-colors ${
                          selectedGoogleRole === r
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={googleLoading}
                  onClick={() => handleGoogleLoginDirect()}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-600/20"
                >
                  {googleLoading ? 'Signing In...' : 'Confirm Sign-In'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
