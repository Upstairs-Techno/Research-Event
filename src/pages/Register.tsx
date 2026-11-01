import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/complete-registration` },
    })
    setBusy(false)
    if (error) setErr(error.message); else setSent(true)
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="card space-y-3 text-center">
          <h1 className="font-serif text-2xl font-bold text-royal-800">Verify your email</h1>
          <p className="text-slate-600">We sent a confirmation link to <b>{email}</b>. Open it, then log in to complete your registration and pay the fee.</p>
          <Link to="/login" className="btn-primary">Go to log in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="font-serif text-2xl font-bold text-royal-800">Create your account</h1>
        <p className="text-sm text-slate-500">Step 1 of 3 — account. Then registration details and payment.</p>
        <div><label className="label" htmlFor="name">Full name</label>
          <input id="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="email">Email address</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="pw">Password</label>
          <input id="pw" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="text-center text-sm">Already registered? <Link to="/login" className="text-royal-700 underline">Log in</Link></p>
      </form>
    </div>
  )
}
