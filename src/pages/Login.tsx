import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, GraduationCap, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

const resetRedirect = 'https://research-distinction.upstairstechno.com/reset-password'

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const routeState = loc.state as { from?: string } | null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(''); setNotice('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErr('We could not sign you in. Check your email and password, then try again.'); setBusy(false); return }
    const { data: p, error: roleError } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (roleError || !p) {
      setErr('Your account was authenticated, but we could not load its access role. Please try again or contact support.')
      setBusy(false)
      await supabase.auth.signOut()
      return
    }
    const participantDestinations = new Set(['/dashboard', '/editor', '/payment', '/complete-registration'])
    const dest = p.role === 'admin' ? '/admin' : p.role === 'judge' ? '/judge' : participantDestinations.has(routeState?.from ?? '') ? routeState!.from! : '/dashboard'
    nav(dest, { replace: true })
  }

  const reset = async (e: FormEvent) => {
    e.preventDefault()
    setErr(''); setNotice('')
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setErr('Enter a valid email address.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: resetRedirect })
      if (error) {
        setErr(/network|fetch/i.test(error.message)
          ? 'We could not reach the password reset service. Check your connection and try again.'
          : error.status === 429 ? 'Too many reset requests. Please wait a few minutes and try again.'
          : 'We could not send reset instructions right now. Please try again shortly.')
      } else {
        setNotice('Password reset instructions have been sent to your registered email address. Please check your inbox.')
      }
    } catch {
      setErr('We could not reach the password reset service. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-700"><GraduationCap size={25}/></span>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[.2em] text-orange-700">Research Distinction Awards</p>
      </div>
      {forgotMode ? <form onSubmit={reset} className="card space-y-4" noValidate>
        <div><h1 className="font-serif text-2xl font-bold text-royal-900">Forgot your password?</h1><p className="mt-1 text-sm text-stone-600">Enter your registered email address and we’ll send you a secure reset link.</p></div>
        <div><label className="label" htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" required autoFocus className="input" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); setNotice('') }} /></div>
        {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : <><Mail className="h-4 w-4"/>Send reset link</>}</button>
        <button type="button" onClick={() => { setForgotMode(false); setErr(''); setNotice('') }} className="w-full text-center text-sm font-semibold text-royal-700 underline">Back to Login</button>
      </form> : <form onSubmit={submit} className="card space-y-4">
        <h1 className="font-serif text-2xl font-bold text-royal-900">Log in</h1>
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="pw">Password</label>
          <div className="relative"><input id="pw" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="input pr-12" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-royal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={() => { setForgotMode(true); setErr(''); setNotice('') }} className="text-royal-700 underline">Forgot password?</button>
          <Link to="/register" className="text-royal-700 underline">Create account</Link>
        </div>
      </form>}
    </section>
  )
}
