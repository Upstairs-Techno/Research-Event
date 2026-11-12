import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Fields = { name: string; email: string; mobile: string; password: string; confirm: string }
type Errors = Partial<Record<keyof Fields, string>>
const initial: Fields = { name: '', email: '', mobile: '+91 ', password: '', confirm: '' }
const passwordRules = [
  { label: '8 characters', test: (v: string) => v.length >= 8 },
  { label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Number', test: (v: string) => /\d/.test(v) },
  { label: 'Special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

function validate(f: Fields): Errors {
  const e: Errors = {}
  if (!/^[\p{L} ]{2,}$/u.test(f.name.trim())) e.name = 'Enter at least 2 letters. Use letters and spaces only.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.'
  const mobileDigits = f.mobile.replace(/\D/g, '').length
  if (!/^\+[1-9][\d\s().-]*$/.test(f.mobile.trim()) || mobileDigits < 8 || mobileDigits > 15) e.mobile = 'Enter a valid number with country code, such as +91 98765 43210.'
  if (!passwordRules.every((r) => r.test(f.password))) e.password = 'Meet all password requirements below.'
  if (!f.confirm || f.confirm !== f.password) e.confirm = 'Passwords must match.'
  return e
}

function friendlyAuthError(error: { message: string; code?: string; status?: number }) {
  if (error.code === 'user_already_exists' || /already registered|user already registered/i.test(error.message)) return 'An account with this email already exists. Please log in instead.'
  if (/rate limit|email rate/i.test(error.message)) return 'Too many attempts. Please wait a few minutes and try again.'
  if (/network|fetch/i.test(error.message)) return 'We could not reach the registration service. Check your connection and try again.'
  if (error.code === 'weak_password' || /password.*(weak|short)|password should be/i.test(error.message)) return 'Choose a stronger password that meets all the requirements below.'
  if (error.code === 'email_address_invalid' || /invalid email/i.test(error.message)) return 'Enter a valid email address.'
  if (error.status && error.status >= 500) return 'The registration service is temporarily unavailable. Please try again shortly.'
  return 'We could not create your account right now. Please try again.'
}

export default function Register() {
  const nav = useNavigate()
  const [fields, setFields] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeSuccess, setNoticeSuccess] = useState(false)

  const update = (key: keyof Fields, value: string) => {
    const next = { ...fields, [key]: value }
    setFields(next)
    if (submitted || touched[key]) setErrors(validate(next))
    setNotice('')
    setNoticeSuccess(false)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    const found = validate(fields)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true); setNotice(''); setNoticeSuccess(false)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: fields.email.trim().toLowerCase(), password: fields.password,
        options: {
          data: { full_name: fields.name.trim(), mobile: fields.mobile.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) {
        setNotice(friendlyAuthError(error))
        return
      }
      if (!data.user) {
        setNotice('We could not confirm that your account was created. Please try again.')
        return
      }
      // Supabase may hide an existing account by returning a user with no identities.
      // A missing session by itself is not evidence that the email is already registered.
      if (data.user.identities?.length === 0) {
        setNotice('An account with this email already exists. Please log in instead.')
        return
      }
      if (!data.session) {
        setNoticeSuccess(true)
        setNotice('Account created successfully. Please check your email to verify your account before logging in.')
        return
      }
      nav('/complete-registration', { replace: true })
    } catch (err) {
      setNotice(friendlyAuthError(err as { message: string; code?: string; status?: number }))
    } finally { setBusy(false) }
  }
  const fieldError = (key: keyof Fields) => submitted || touched[key] ? errors[key] : undefined
  const blur = (key: keyof Fields) => { setTouched((v) => ({ ...v, [key]: true })); setErrors(validate(fields)) }
  const inputClass = (key: keyof Fields) => `mt-1 w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 ${fieldError(key) ? 'border-red-400' : 'border-stone-300'}`

  return <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
    <div className="mb-7 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-700"><GraduationCap size={25} /></span>
      <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-orange-700">Research Distinction Awards</p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-royal-900 sm:text-4xl">Begin your journey</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">Create your secure account to enter the academic competition.</p>
    </div>
    <ol aria-label="Registration progress" className="mx-auto mb-7 grid max-w-2xl grid-cols-3">
      {['Create account', 'Your details', 'Payment'].map((label, i) => <li key={label} className="relative flex flex-col items-center text-center text-[11px] font-semibold text-stone-500 sm:text-xs">
        <span className={`z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 ${i === 0 ? 'border-orange-600 bg-orange-600 text-white' : 'border-stone-300 bg-white'}`}>{i === 0 ? <Check size={17} /> : i + 1}</span>
        <span className="mt-2">{label}</span>{i < 2 && <span className="absolute left-[58%] top-[18px] h-px w-[84%] bg-stone-300" />}
      </li>)}
    </ol>
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_18px_60px_-35px_rgba(49,36,26,.35)] sm:p-8">
      <div className="mb-6 flex items-center gap-3 border-b border-stone-100 pb-5"><ShieldCheck className="text-orange-700" size={23} /><div><h2 className="font-serif text-xl font-bold text-royal-900">Create your account</h2><p className="mt-0.5 text-xs text-stone-500">Step 1 of 3 · Account details</p></div></div>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <div><label htmlFor="fullName" className="text-sm font-semibold text-stone-800">Full name</label><input id="fullName" autoComplete="name" onBlur={() => blur('name')} className={inputClass('name')} placeholder="As it should appear on your certificate" value={fields.name} onChange={(e) => update('name', e.target.value)} aria-invalid={!!fieldError('name')} aria-describedby={fieldError('name') ? 'name-error' : undefined} />{fieldError('name') && <p id="name-error" className="mt-1 text-xs text-red-700">{fieldError('name')}</p>}</div>
        <div><label htmlFor="email" className="text-sm font-semibold text-stone-800">Email address</label><input id="email" type="email" autoComplete="email" onBlur={() => blur('email')} className={inputClass('email')} placeholder="you@example.com" value={fields.email} onChange={(e) => update('email', e.target.value)} aria-invalid={!!fieldError('email')} aria-describedby={fieldError('email') ? 'email-error' : undefined} />{fieldError('email') && <p id="email-error" className="mt-1 text-xs text-red-700">{fieldError('email')}</p>}</div>
        <div className="sm:col-span-2"><label htmlFor="mobile" className="text-sm font-semibold text-stone-800">Mobile number</label><input id="mobile" type="tel" inputMode="tel" autoComplete="tel" onBlur={() => blur('mobile')} className={inputClass('mobile')} placeholder="+91 98765 43210" value={fields.mobile} onChange={(e) => update('mobile', e.target.value)} aria-invalid={!!fieldError('mobile')} aria-describedby={fieldError('mobile') ? 'mobile-error' : 'mobile-help'} />{fieldError('mobile') ? <p id="mobile-error" className="mt-1 text-xs text-red-700">{fieldError('mobile')}</p> : <p id="mobile-help" className="mt-1 text-xs text-stone-500">Include your country calling code. India is preselected.</p>}</div>
        <div><label htmlFor="password" className="text-sm font-semibold text-stone-800">Password</label><div className="relative mt-1"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${inputClass('password')} pr-12`} placeholder="Create a strong password" value={fields.password} onChange={(e) => update('password', e.target.value)} aria-invalid={!!fieldError('password')} aria-describedby="password-rules" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-500 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{fieldError('password') && <p className="mt-1 text-xs text-red-700">{fieldError('password')}</p>}<ul id="password-rules" className="mt-2 grid grid-cols-2 gap-1 text-[11px] sm:grid-cols-1">{passwordRules.map((r) => <li key={r.label} className={r.test(fields.password) ? 'text-emerald-700' : 'text-stone-500'}>{r.test(fields.password) ? '✓' : '○'} {r.label}</li>)}</ul></div>
        <div><label htmlFor="confirmPassword" className="text-sm font-semibold text-stone-800">Confirm password</label><div className="relative mt-1"><input id="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" className={`${inputClass('confirm')} pr-12`} placeholder="Enter your password again" value={fields.confirm} onChange={(e) => update('confirm', e.target.value)} aria-invalid={!!fieldError('confirm')} aria-describedby={fieldError('confirm') ? 'confirm-error' : undefined} /><button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-500 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600">{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{fieldError('confirm') && <p id="confirm-error" className="mt-1 text-xs text-red-700">{fieldError('confirm')}</p>}</div>
      </div>
      {notice && <p role={noticeSuccess ? 'status' : 'alert'} className={`mt-5 rounded-lg border px-3 py-2.5 text-sm ${noticeSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{notice}</p>}
      <button className="btn-primary mt-7 w-full py-3" disabled={busy}>{busy ? 'Creating secure account…' : 'Create account'}</button>
      <p className="mt-4 text-center text-sm text-stone-600">Already registered? <Link to="/login" className="font-semibold text-orange-700 underline">Log in</Link></p>
      <p className="mt-4 text-center text-xs leading-5 text-stone-500">Your password is sent securely to Supabase Auth and is never stored or logged by this form.</p>
    </form>
  </section>
}
