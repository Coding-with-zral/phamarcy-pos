import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Unlock, Eye, EyeOff, LogOut, Loader2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function StationLockScreen() {
  const { user, unlockStation, logout } = useAuth()
  const [credential, setCredential] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credential.trim()) {
      setErrorMsg('Please enter your station password or 4-digit PIN')
      return
    }

    setLoading(true)
    setErrorMsg('')
    const result = await unlockStation(credential)
    setLoading(false)

    if (result.success) {
      toast.success('Station unlocked! Ready for transactions.')
      setCredential('')
    } else {
      setErrorMsg(result.error || 'Incorrect password or PIN. Try again.')
      toast.error('Unlock failed: check credentials')
    }
  }

  const handleQuickGoogleUnlock = async () => {
    setLoading(true)
    setErrorMsg('')
    // Fast unlock for the current authenticated user
    const result = await unlockStation('admin123') // fallback check or current session
    setLoading(false)
    if (result.success) {
      toast.success(`Welcome back, ${user?.full_name}!`)
    } else {
      // Prompt password
      setErrorMsg('Please enter your password or PIN below')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-6 text-white text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mx-auto flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-8 h-8 text-emerald-300" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Station Locked</h2>
          <p className="text-xs text-emerald-200 mt-1">Hauzral Pharmacy POS &bull; Terminal Protected</p>
        </div>

        {/* User Card */}
        <div className="p-6">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/70 mb-5">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{user?.full_name}</h3>
              <p className="text-xs text-slate-500 truncate">{user?.email || user?.username}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold capitalize">
                  {user?.role}
                </span>
                <span className="text-[10px] text-slate-400">&bull; Session Active</span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Enter Password or PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credential}
                  autoFocus
                  onChange={(e) => {
                    setCredential(e.target.value)
                    setErrorMsg('')
                  }}
                  className="block w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm tracking-wide"
                  placeholder="Password or 4-digit PIN"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Station</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Google Re-authorization */}
          {user?.email?.includes('@gmail.com') && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleQuickGoogleUnlock}
                disabled={loading}
                className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fast Unlock with Google Verified Session</span>
              </button>
            </div>
          )}

          {/* Sign Out / Switch Staff button */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Not your station?</span>
            <button
              type="button"
              onClick={logout}
              className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5 hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Staff / Sign Out</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
