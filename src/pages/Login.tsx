import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const routeState = loc.state as { from?: string; authError?: string } | null
  const initialAuthError = routeState?.authError ?? `${loc.search}${loc.hash}`
  const linkExpired = /otp_expired|access_denied|expired/i.test(initialAuthError)
  const [verificationHint, setVerificationHint] = useState(linkExpired ? 'That verification link has expired or is no longer valid. Request a fresh link below.' : '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErr(/email not confirmed/i.test(error.message) ? 'Please verify your email before logging in. You can request a new verification email below.' : 'We could not sign you in. Check your email and password, then try again.'); setBusy(false); return }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    const dest = p?.role === 'admin' ? '/admin' : p?.role === 'judge' ? '/judge' : (routeState?.from ?? '/dashboard')
    nav(dest, { replace: true })
  }

  const resendVerification = async () => {
    if (!email) { setErr('Enter your email address first.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/complete-registration` } })
    setBusy(false)
    if (error && /already confirmed/i.test(error.message)) setVerificationHint('This email is already verified. Log in to continue.')
    else setVerificationHint('If an unverified account exists for this address, a fresh verification link has been sent. Check your inbox and spam folder.')
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
          <input id="pw" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        {verificationHint && <div role="status" className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-stone-700"><p>{verificationHint}</p><button type="button" disabled={busy} onClick={resendVerification} className="font-semibold text-orange-800 underline">Resend verification email</button></div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={reset} className="text-royal-700 underline">Forgot password?</button>
          <Link to="/register" className="text-royal-700 underline">Create account</Link>
        </div>
      </form>
    </div>
  )
}
