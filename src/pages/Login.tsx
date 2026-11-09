import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const routeState = loc.state as { from?: string } | null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
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

  const reset = async () => {
    if (!email) { setErr('Enter your email first.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setErr(error ? error.message : 'Password reset email sent.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="font-serif text-2xl font-bold text-royal-800">Log in</h1>
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="pw">Password</label>
          <div className="relative"><input id="pw" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="input pr-12" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-royal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={reset} className="text-royal-700 underline">Forgot password?</button>
          <Link to="/register" className="text-royal-700 underline">Create account</Link>
        </div>
      </form>
    </div>
  )
}
