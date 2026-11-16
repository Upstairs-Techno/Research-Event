import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const recoveryMarker = 'rda-password-recovery'
const passwordRules = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'An uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'A lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'A number', test: (value: string) => /\d/.test(value) },
  { label: 'A special character', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

export default function ResetPassword() {
  const { session, recoverySession, loading } = useAuth()
  const [validating, setValidating] = useState(true)
  const [validRecovery, setValidRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    const validateRecovery = async () => {
      if (loading) return
      if (!session || !recoverySession) {
        if (active) {
          window.sessionStorage.removeItem(recoveryMarker)
          setValidRecovery(false)
          setValidating(false)
        }
        return
      }
      const { data, error: userError } = await supabase.auth.getUser()
      if (!active) return
      const markerMatchesUser = window.sessionStorage.getItem(recoveryMarker) === session.user.id
      if (userError || !data.user || data.user.id !== session.user.id || !markerMatchesUser) {
        window.sessionStorage.removeItem(recoveryMarker)
        setValidRecovery(false)
      } else {
        setValidRecovery(true)
      }
      setValidating(false)
    }
    void validateRecovery()
    return () => { active = false }
  }, [loading, recoverySession, session])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    setError('')
    if (!validRecovery || !session) {
      setError('This password reset link is no longer valid. Request a new link and try again.')
      return
    }
    if (!password) { setError('Enter a new password.'); return }
    if (!passwordRules.every((rule) => rule.test(password))) {
      setError('Choose a password that meets every requirement below.')
      return
    }
    if (password !== confirm) { setError('The passwords do not match.'); return }
    submitting.current = true
    setBusy(true)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user || userData.user.id !== session.user.id) {
      setError('Your password reset session has expired. Request a new reset link.')
      setValidRecovery(false)
      window.sessionStorage.removeItem(recoveryMarker)
      submitting.current = false
      setBusy(false)
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(/network|fetch/i.test(updateError.message)
        ? 'We could not reach the password service. Check your connection and try again.'
        : /weak|short|password/i.test(updateError.message)
          ? 'The password was not accepted. Choose a stronger password and try again.'
          : 'We could not update your password. The reset link may have expired; request a new one and try again.')
      submitting.current = false
      setBusy(false)
      return
    }
    window.sessionStorage.removeItem(recoveryMarker)
    await supabase.auth.signOut()
    setPassword('')
    setConfirm('')
    setSuccess(true)
    setValidRecovery(false)
    submitting.current = false
    setBusy(false)
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 pr-12 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100'

  return <section className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-14">
    <div className="mb-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-700"><GraduationCap size={25}/></span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[.2em] text-orange-700">Research Distinction Awards</p>
    </div>
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_18px_60px_-35px_rgba(49,36,26,.35)] sm:p-8">
      {success ? <div className="space-y-5 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check size={24}/></span>
        <div><h1 className="font-serif text-2xl font-bold text-royal-900">Password updated</h1><p role="status" className="mt-2 text-sm leading-6 text-stone-600">Your password has been updated successfully. You can now log in using your new password.</p></div>
        <Link className="btn-primary w-full" to="/login">Go to Login</Link>
      </div> : validating || loading ? <div role="status" className="py-8 text-center text-sm text-stone-600">Validating your secure reset link…</div>
        : !validRecovery ? <div className="space-y-4 text-center">
          <h1 className="font-serif text-2xl font-bold text-royal-900">Reset link unavailable</h1>
          <p role="alert" className="text-sm leading-6 text-stone-600">This password reset link is invalid, expired, or has already been used. Request a new reset email to continue.</p>
          <Link className="btn-primary w-full" to="/login">Back to Login</Link>
        </div> : <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="flex items-center gap-3 border-b border-stone-100 pb-5"><ShieldCheck className="shrink-0 text-orange-700" size={23}/><div><h1 className="font-serif text-2xl font-bold text-royal-900">Reset Your Password</h1><p className="mt-1 text-xs text-stone-500">Choose a new password for your account.</p></div></div>
          <div><label htmlFor="new-password" className="text-sm font-semibold text-stone-800">New Password</label><div className="relative"><input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required className={inputClass} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }}/><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-stone-500 hover:text-royal-800">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></div>
          <div><label htmlFor="confirm-password" className="text-sm font-semibold text-stone-800">Confirm New Password</label><div className="relative"><input id="confirm-password" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required className={inputClass} value={confirm} onChange={(event) => { setConfirm(event.target.value); setError('') }}/><button type="button" onClick={() => setShowConfirm((visible) => !visible)} aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirm} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-stone-500 hover:text-royal-800">{showConfirm ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></div>
          <ul aria-label="Password requirements" className="space-y-1 rounded-xl bg-orange-50/70 p-3 text-xs text-stone-600">{passwordRules.map((rule) => <li key={rule.label} className="flex items-center gap-2"><span className={rule.test(password) ? 'text-emerald-700' : 'text-stone-400'}>{rule.test(password) ? '✓' : '•'}</span>{rule.label}</li>)}</ul>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Updating password…' : 'Update Password'}</button>
          <Link to="/login" className="block text-center text-sm font-semibold text-royal-700 underline">Back to Login</Link>
        </form>}
    </div>
  </section>
}
