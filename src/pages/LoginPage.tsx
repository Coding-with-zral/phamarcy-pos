import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Pill, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { post } from '../utils/api'
import type { User } from '../types'

interface AuthResponse {
  token: string
  user: User
}

type Tab = 'login' | 'register'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'cashier' | 'pharmacist' | 'admin'>('cashier')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryId, setRecoveryId] = useState('')
  const [recoveryPin, setRecoveryPin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request')
  const { login } = useAuth()
  const navigate = useNavigate()

  const completeLogin = (result: AuthResponse) => {
    login(result.token, result.user)
    toast.success(`Welcome, ${result.user.full_name}!`)
    navigate('/pos')
  }

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Enter your username and password to continue.')
      return
    }
    setLoading(true)
    try {
      const result = await post<AuthResponse>('/auth/login', { username: username.trim(), password })
      if (remember) localStorage.setItem('hauzral_saved_username', username.trim())
      else localStorage.removeItem('hauzral_saved_username')
      completeLogin(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in. Check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 6) {
      toast.error('Use a password with at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Your passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await post<AuthResponse>('/auth/register', {
        full_name: fullName.trim(), username: username.trim(), password,
        role, email: email.trim() || undefined,
      })
      toast.success('Account created. Sign in with your new credentials.')
      setTab('login')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create the account.')
    } finally {
      setLoading(false)
    }
  }

  const requestRecovery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    try {
      const result = await post<{ success: boolean; reset_pin?: string; message?: string }>('/auth/forgot-password', { identifier: recoveryId.trim() })
      if (!result.success || !result.reset_pin) throw new Error(result.message || 'Could not create a recovery code.')
      setRecoveryPin(result.reset_pin)
      setRecoveryStep('reset')
      toast.success('Recovery code ready. Keep it private.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start password recovery.')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Use a password with at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await post('/auth/reset-password', { identifier: recoveryId.trim(), pin: recoveryPin.trim(), new_password: newPassword })
      toast.success('Password updated. You can now sign in.')
      setUsername(recoveryId.trim())
      setPassword('')
      setRecoveryOpen(false)
      setRecoveryStep('request')
      setNewPassword('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reset the password.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10'
  const labelStyle = 'mb-1.5 block text-xs font-semibold tracking-wide text-slate-700'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f7f5] text-slate-900">
      <Toaster position="top-right" />
      <div className="pointer-events-none absolute -left-36 -top-32 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[30rem] w-[30rem] rounded-full bg-teal-100/70 blur-3xl" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#073b36] px-12 py-10 text-white lg:flex xl:px-20 xl:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,rgba(16,185,129,0.28),transparent_35%),radial-gradient(ellipse_at_10%_85%,rgba(20,184,166,0.2),transparent_35%)]" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/20"><Pill size={25} /></div>
            <div><p className="text-lg font-bold tracking-tight">Hauzral Pharmacy</p><p className="text-xs font-medium tracking-[0.18em] text-emerald-200">POINT OF SALE</p></div>
          </div>
          <div className="relative my-12 max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-100"><ShieldCheck size={15} /> A better day at the pharmacy</div>
            <h1 className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-6xl">Care for people. <span className="text-emerald-300">Clarity for your business.</span></h1>
            <p className="mt-6 max-w-md text-base leading-7 text-emerald-50/75">Manage your counter, inventory, prescriptions, and daily sales from one calm, connected workspace.</p>
            <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
              {[['Inventory', 'Track batches and expiry dates'], ['Checkout', 'Keep the counter moving'], ['Prescriptions', 'Stay on top of patient care'], ['Reports', 'See how your pharmacy is doing']].map(([title, detail]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm"><p className="text-sm font-semibold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-emerald-50/65">{detail}</p></div>
              ))}
            </div>
          </div>
          <p className="relative text-xs text-emerald-100/55">© {new Date().getFullYear()} Hauzral Health ERP</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-20">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[440px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-white"><Pill size={23} /></div>
              <div><p className="font-bold text-slate-900">Hauzral Pharmacy</p><p className="text-[11px] font-semibold tracking-[0.16em] text-emerald-700">POINT OF SALE</p></div>
            </div>
            <div className="mb-7">
              <p className="text-sm font-semibold text-emerald-700">Your pharmacy workspace</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{tab === 'login' ? 'Welcome back' : 'Create staff account'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{tab === 'login' ? 'Sign in with your staff credentials to continue.' : 'Set up a staff profile to get started.'}</p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-2 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.24)]">
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-50 p-1">
                {(['login', 'register'] as const).map((current) => (
                  <button key={current} type="button" onClick={() => setTab(current)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === current ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                    {current === 'login' ? 'Sign in' : 'Register'}
                  </button>
                ))}
              </div>
              <div className="p-4 pt-6 sm:p-6">
                <AnimatePresence mode="wait">
                  {tab === 'login' ? (
                    <motion.form key="sign-in" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} onSubmit={handleLogin} className="space-y-5">
                      <div><label className={labelStyle} htmlFor="staff-username">Staff username</label><div className="relative"><UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input id="staff-username" className={`${inputStyle} pl-10`} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your username" required /></div></div>
                      <div><div className="mb-1.5 flex items-center justify-between"><label className={`${labelStyle} mb-0`} htmlFor="staff-password">Password</label><button type="button" onClick={() => { setRecoveryId(username); setRecoveryOpen(true) }} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Forgot password?</button></div><div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input id="staff-password" className={`${inputStyle} pl-10 pr-12`} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-700" />Remember username on this device</label>
                      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-700/20 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Signing in…' : <>Sign in to your workspace <ArrowRight size={17} /></>}</button>
                    </motion.form>
                  ) : (
                    <motion.form key="register" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} onSubmit={handleRegister} className="space-y-4">
                      <div><label className={labelStyle} htmlFor="staff-name">Full name</label><input id="staff-name" className={inputStyle} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" required /></div>
                      <div><label className={labelStyle} htmlFor="staff-email">Email <span className="font-normal text-slate-400">(optional)</span></label><input id="staff-email" className={inputStyle} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@pharmacy.com" /></div>
                      <div className="grid grid-cols-2 gap-3"><div><label className={labelStyle} htmlFor="new-username">Username</label><input id="new-username" className={inputStyle} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" required /></div><div><label className={labelStyle} htmlFor="staff-role">Role</label><select id="staff-role" className={inputStyle} value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="cashier">Cashier</option><option value="pharmacist">Pharmacist</option><option value="admin">Administrator</option></select></div></div>
                      <div><label className={labelStyle} htmlFor="new-password">Password</label><input id="new-password" className={inputStyle} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" minLength={6} required /></div>
                      <div><label className={labelStyle} htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className={inputStyle} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter password again" required /></div>
                      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60">{loading ? 'Creating account…' : <><UserRoundPlus size={17} />Create staff account</>}</button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-emerald-700" />Secure staff access</div>
            {import.meta.env.DEV && tab === 'login' && <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-900">Developer shortcuts</p><div className="flex flex-wrap gap-2">{['admin', 'pharmacist', 'cashier'].map((demoUser) => <button key={demoUser} type="button" onClick={() => { setUsername(demoUser); setPassword(`${demoUser}123`) }} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium capitalize text-emerald-800 hover:bg-emerald-100">{demoUser}</button>)}</div></div>}
          </motion.div>
        </section>
      </div>

      <AnimatePresence>
        {recoveryOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><KeyRound size={20} /></div><div><h3 className="font-semibold text-slate-900">Password recovery</h3><p className="text-xs text-slate-500">Recover access to your staff account</p></div></div><form onSubmit={recoveryStep === 'request' ? requestRecovery : resetPassword} className="space-y-4">{recoveryStep === 'request' ? <><div><label className={labelStyle} htmlFor="recovery-id">Username or email</label><input id="recovery-id" className={inputStyle} value={recoveryId} onChange={(event) => setRecoveryId(event.target.value)} required /></div><button className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={loading}>{loading ? 'Preparing code…' : 'Get recovery code'}</button></> : <><div className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">Recovery code: <strong className="font-mono">{recoveryPin}</strong><br />Keep this code private.</div><div><label className={labelStyle} htmlFor="reset-pin">Recovery code</label><input id="reset-pin" className={inputStyle} value={recoveryPin} onChange={(event) => setRecoveryPin(event.target.value)} required /></div><div><label className={labelStyle} htmlFor="reset-password">New password</label><input id="reset-password" className={inputStyle} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} required /></div><button className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={loading}>{loading ? 'Updating…' : 'Set new password'}</button></>}<button type="button" onClick={() => { setRecoveryOpen(false); setRecoveryStep('request') }} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button></form></motion.div></div>}
      </AnimatePresence>
    </main>
  )
}
