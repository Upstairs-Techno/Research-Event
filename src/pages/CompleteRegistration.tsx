import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Category { id: string; name: string }

export default function CompleteRegistration() {
  const { user, fullName } = useAuth()
  const nav = useNavigate()
  const [cats, setCats] = useState<Category[]>([])
  const [f, setF] = useState({ mobile: '', institution: '', qualification: '', country: 'India', category_id: '', research_title: '', abstract: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    supabase.from('research_categories').select('id, name').eq('active', true).then(({ data }) => setCats(data ?? []))
    if (!user) return
    setF((current) => ({ ...current, mobile: current.mobile || String(user.user_metadata.mobile ?? '') }))
    supabase.from('registrations').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) nav('/dashboard', { replace: true }) })
  }, [user, nav])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setBusy(true); setErr('')
    const { data: part, error: pe } = await supabase.from('participants')
      .upsert({ user_id: user.id, mobile: f.mobile || String(user.user_metadata.mobile ?? ''), institution: f.institution, qualification: f.qualification, country: f.country }, { onConflict: 'user_id' })
      .select('id').single()
    if (pe || !part) { setErr(pe?.message ?? 'Could not save details'); setBusy(false); return }
    const { error: re } = await supabase.from('registrations').upsert({
      user_id: user.id, participant_id: part.id, category_id: f.category_id,
      research_title: f.research_title, abstract: f.abstract,
    }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (re) { setErr(re.message); setBusy(false); return }
    nav('/payment')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <ol aria-label="Registration progress" className="mx-auto mb-7 grid max-w-2xl grid-cols-3">
        {['Create account', 'Your details', 'Payment'].map((label, i) => <li key={label} className="relative flex flex-col items-center text-center text-[11px] font-semibold text-stone-500 sm:text-xs">
          <span className={`z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 ${i < 2 ? 'border-orange-600 bg-orange-600 text-white' : 'border-stone-300 bg-white'}`}>{i < 2 ? '✓' : i + 1}</span>
          <span className="mt-2">{label}</span>{i < 2 && <span className="absolute left-[58%] top-[18px] h-px w-[84%] bg-orange-300" />}
        </li>)}
      </ol>
      <form onSubmit={submit} className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_18px_60px_-35px_rgba(49,36,26,.35)] sm:p-8">
        <h1 className="font-serif text-2xl font-bold text-royal-900">Your competition details</h1>
        <p className="mt-1 text-sm text-stone-600">Step 2 of 3 · Tell us where you study and about your research.</p>
        <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-stone-600">Signed in as <strong className="text-stone-800">{fullName} ({user?.email})</strong></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="m">Mobile number</label>
            <input id="m" type="tel" required className="input" placeholder="+91 98765 43210" value={f.mobile} onChange={(e) => set('mobile', e.target.value)} /></div>
          <div><label className="label" htmlFor="c">Country</label>
            <input id="c" required autoComplete="country-name" className="input" value={f.country} onChange={(e) => set('country', e.target.value)} /></div>
          <div><label className="label" htmlFor="i">Institution / organization</label>
            <input id="i" required className="input" value={f.institution} onChange={(e) => set('institution', e.target.value)} /></div>
          <div><label className="label" htmlFor="q">Qualification / designation</label>
            <input id="q" required className="input" value={f.qualification} onChange={(e) => set('qualification', e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="cat">Research category</label>
          <select id="cat" required className="input" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">Select…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label" htmlFor="t">Research title</label>
          <input id="t" required minLength={5} maxLength={300} className="input" value={f.research_title} onChange={(e) => set('research_title', e.target.value)} /></div>
        <div><label className="label" htmlFor="a">Research abstract (50–4000 characters)</label>
          <textarea id="a" required minLength={50} maxLength={4000} rows={6} className="input" value={f.abstract} onChange={(e) => set('abstract', e.target.value)} /></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save & continue to payment'}</button>
      </form>
    </div>
  )
}
