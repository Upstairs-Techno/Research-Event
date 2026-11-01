import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, rupees } from '../lib/utils'
import ReportPanel from '../components/ReportPanel'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tab = 'overview' | 'registrations' | 'payments' | 'submissions' | 'judges' | 'settings' | 'results' | 'audit'
const TABS: Tab[] = ['overview', 'registrations', 'payments', 'submissions', 'judges', 'settings', 'results', 'audit']

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
function download(name: string, csv: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  a.click()
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview')
  const [msg, setMsg] = useState('')
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <h1 className="font-serif text-3xl font-bold text-royal-800">Admin dashboard</h1>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setMsg('') }}
            className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-royal-800 text-royal-800' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>
      {msg && <p role="status" className="rounded bg-gold-100 p-2 text-sm text-royal-900">{msg}</p>}
      {tab === 'overview' && <Overview />}
      {tab === 'registrations' && <Registrations />}
      {tab === 'payments' && <Payments />}
      {tab === 'submissions' && <Submissions setMsg={setMsg} />}
      {tab === 'judges' && <Judges setMsg={setMsg} />}
      {tab === 'settings' && <SettingsTab setMsg={setMsg} />}
      {tab === 'results' && <ResultsTab setMsg={setMsg} />}
      {tab === 'audit' && <Audit />}
    </div>
  )
}

function Overview() {
  const [s, setS] = useState<any>(null)
  useEffect(() => { supabase.rpc('admin_stats').then(({ data }) => setS(data)) }, [])
  if (!s) return <p className="text-slate-500">Loading…</p>
  const cards: [string, string | number][] = [
    ['Registered participants', s.participants], ['Successful payments', s.paid], ['Failed payments', s.failed_payments],
    ['Registration revenue', rupees(s.revenue_paise)], ['Submitted papers', s.submitted], ['Pending evaluations', s.pending_evals],
    ['Completed evaluations', s.completed_evals], ['Flagged submissions', s.flagged],
  ]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([k, v]) => (
          <div key={k} className="card"><p className="text-xs text-slate-500">{k}</p><p className="font-serif text-2xl font-bold text-royal-800">{v}</p></div>
        ))}
      </div>
      <div className="card text-sm">
        <h2 className="mb-2 font-semibold text-royal-800">Participants by category</h2>
        {s.by_category.map((c: any) => <p key={c.name}>{c.name}: <b>{c.count}</b></p>)}
      </div>
    </div>
  )
}

function Registrations() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('registrations')
      .select('*, profiles(full_name, email), participants(participant_code, mobile, institution, country), research_categories(name)')
      .order('created_at', { ascending: false }).then(({ data }) => setRows(data ?? []))
  }, [])
  const flat = rows.map((r) => ({
    participant_id: r.participants?.participant_code, name: r.profiles?.full_name, email: r.profiles?.email, mobile: r.participants?.mobile,
    institution: r.participants?.institution, country: r.participants?.country, category: r.research_categories?.name,
    title: r.research_title, status: r.status, registered: r.created_at,
  }))
  return (
    <div className="space-y-2">
      <button className="btn-outline" onClick={() => download('participants.csv', toCsv(flat))}>Export CSV</button>
      <Table cols={['participant_id', 'name', 'email', 'category', 'title', 'status']} rows={flat} />
    </div>
  )
}

function Payments() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('payments').select('*, profiles(full_name, email)').order('created_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [])
  const flat = rows.map((p) => ({
    name: p.profiles?.full_name, email: p.profiles?.email, amount: rupees(p.amount_paise), status: p.status,
    order_id: p.razorpay_order_id, payment_id: p.razorpay_payment_id, paid_at: p.paid_at ? fmtDate(p.paid_at) : '',
  }))
  return (
    <div className="space-y-2">
      <button className="btn-outline" onClick={() => download('payments.csv', toCsv(flat))}>Export CSV</button>
      <Table cols={['name', 'email', 'amount', 'status', 'order_id', 'payment_id', 'paid_at']} rows={flat} />
    </div>
  )
}

function Submissions({ setMsg }: { setMsg: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [judges, setJudges] = useState<any[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [pick, setPick] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data } = await supabase.from('submissions')
      .select('*, profiles(full_name, email), registrations(research_categories(name)), originality_reports(kind, score, status, details, created_at), evaluations(total, status, approved), judge_assignments(judge_id)')
      .eq('locked', true).order('submitted_at', { ascending: false })
    setRows(data ?? [])
    const { data: j } = await supabase.from('judges').select('user_id, profiles(full_name, email)')
    setJudges(j ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (p: PromiseLike<any>, ok: string) => {
    const res = await p
    const err = res.error?.message ?? res.data?.error
    setMsg(err ?? ok)
    load()
  }

  const flat = rows.map((s) => ({
    title: s.title, participant: s.profiles?.full_name, email: s.profiles?.email, category: s.registrations?.research_categories?.name,
    status: s.status, flagged: s.flagged, words: s.word_count, submitted_at: s.submitted_at,
  }))

  return (
    <div className="space-y-3">
      <button className="btn-outline" onClick={() => download('submissions.csv', toCsv(flat))}>Export CSV</button>
      {rows.length === 0 && <p className="text-slate-500">No submitted papers yet.</p>}
      {rows.map((s) => {
        const reports = [...(s.originality_reports ?? [])].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
        const submittedEvals = (s.evaluations ?? []).filter((e: any) => e.status === 'submitted')
        const avg = submittedEvals.length ? (submittedEvals.reduce((n: number, e: any) => n + Number(e.total), 0) / submittedEvals.length).toFixed(2) : '—'
        return (
          <div key={s.id} className="card space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-royal-800">{s.title}</p>
                <p className="text-xs text-slate-500">{s.profiles?.full_name} · {s.registrations?.research_categories?.name} · {s.status}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.flagged && <span className="badge bg-red-100 text-red-700">Flagged</span>}
                <span className="badge bg-royal-100 text-royal-800">{(s.judge_assignments ?? []).length} judge(s)</span>
                <span className="badge bg-slate-100 text-slate-700">{submittedEvals.length} scored · avg {avg}</span>
                {submittedEvals.some((e: any) => e.approved) && <span className="badge bg-green-100 text-green-800">Approved</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !w-auto" value={pick[s.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [s.id]: e.target.value }))}>
                <option value="">Assign judge…</option>
                {judges.map((j) => <option key={j.user_id} value={j.user_id}>{j.profiles?.full_name || j.profiles?.email}</option>)}
              </select>
              <button className="btn-outline !py-1" disabled={!pick[s.id]} onClick={() => act(supabase.rpc('assign_judge', { p_submission: s.id, p_judge: pick[s.id] }), 'Judge assigned.')}>Assign</button>
              <button className="btn-outline !py-1" onClick={() => act(supabase.functions.invoke('run-originality', { body: { submission_id: s.id } }), 'Originality analysis run.')}>Run originality</button>
              <button className="btn-outline !py-1" disabled={!submittedEvals.length} onClick={() => act(supabase.rpc('approve_evaluations', { p_submission: s.id }), 'Scores approved.')}>Approve scores</button>
              <button className="btn-outline !py-1" onClick={() => confirm('Unlock this paper for the participant to edit and resubmit?') && act(supabase.rpc('admin_unlock_submission', { p_submission: s.id }), 'Submission unlocked.')}>Unlock</button>
              <button className="text-xs text-royal-700 underline" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? 'Hide' : 'Show'} reports</button>
            </div>
            {open === s.id && <div className="rounded bg-slate-50 p-3"><ReportPanel reports={reports} /></div>}
          </div>
        )
      })}
    </div>
  )
}

function Judges({ setMsg }: { setMsg: (m: string) => void }) {
  const [email, setEmail] = useState('')
  const [judges, setJudges] = useState<any[]>([])
  const load = useCallback(() => {
    supabase.from('judges').select('user_id, profiles(full_name, email)').then(({ data }) => setJudges(data ?? []))
  }, [])
  useEffect(load, [load])

  const setRole = async (role: 'judge' | 'participant') => {
    const { error } = await supabase.rpc('admin_set_role', { p_email: email.trim(), p_role: role })
    setMsg(error ? error.message : `Role updated to ${role}.`)
    load()
  }
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="je">Account email (the person must have signed up already)</label>
          <input id="je" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={!email} onClick={() => setRole('judge')}>Make judge</button>
        <button className="btn-outline" disabled={!email} onClick={() => setRole('participant')}>Remove judge role</button>
      </div>
      <div className="card text-sm">
        <h2 className="mb-2 font-semibold text-royal-800">Judges</h2>
        {judges.length === 0 ? <p className="text-slate-500">None yet.</p> : judges.map((j) => <p key={j.user_id}>{j.profiles?.full_name} — {j.profiles?.email}</p>)}
      </div>
    </div>
  )
}

function SettingsTab({ setMsg }: { setMsg: (m: string) => void }) {
  const [s, setS] = useState<any>(null)
  const [rubric, setRubric] = useState('')
  const [cats, setCats] = useState<any[]>([])
  const [newCat, setNewCat] = useState('')
  useEffect(() => {
    supabase.from('competition_settings').select('*').eq('id', 1).single().then(({ data }) => { setS(data); setRubric(JSON.stringify(data?.rubric ?? [], null, 2)) })
    supabase.from('research_categories').select('*').then(({ data }) => setCats(data ?? []))
  }, [])
  if (!s) return <p className="text-slate-500">Loading…</p>

  const save = async () => {
    let parsed
    try { parsed = JSON.parse(rubric) } catch { setMsg('Rubric is not valid JSON.'); return }
    const total = parsed.reduce((n: number, r: any) => n + Number(r.weight), 0)
    if (total !== 100) { setMsg(`Rubric weights must add up to 100 (currently ${total}).`); return }
    const { error } = await supabase.from('competition_settings').update({
      name: s.name, fee_paise: s.fee_paise, registration_open: s.registration_open, refund_policy: s.refund_policy,
      submission_deadline: s.submission_deadline, rubric: parsed, updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setMsg(error ? error.message : 'Settings saved.')
  }
  const addCat = async () => {
    const slug = newCat.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const { error } = await supabase.from('research_categories').insert({ name: newCat, slug })
    setMsg(error ? error.message : 'Category added.')
    setNewCat('')
    supabase.from('research_categories').select('*').then(({ data }) => setCats(data ?? []))
  }
  const local = s.submission_deadline ? new Date(new Date(s.submission_deadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 text-sm sm:grid-cols-2">
        <div><label className="label">Competition name</label><input className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
        <div><label className="label">Fee (paise; 49900 = ₹499)</label><input type="number" className="input" value={s.fee_paise} onChange={(e) => setS({ ...s, fee_paise: Number(e.target.value) })} /></div>
        <div><label className="label">Submission deadline</label>
          <input type="datetime-local" className="input" value={local} onChange={(e) => setS({ ...s, submission_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
        <label className="flex items-center gap-2 pt-6"><input type="checkbox" checked={s.registration_open} onChange={(e) => setS({ ...s, registration_open: e.target.checked })} /> Registration open</label>
        <div className="sm:col-span-2"><label className="label">Refund &amp; cancellation policy</label><textarea rows={3} className="input" value={s.refund_policy} onChange={(e) => setS({ ...s, refund_policy: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Scoring rubric (JSON, weights must total 100 — approve with organizers before submissions open)</label>
          <textarea rows={10} className="input font-mono text-xs" value={rubric} onChange={(e) => setRubric(e.target.value)} /></div>
        <div className="sm:col-span-2"><button className="btn-primary" onClick={save}>Save settings</button></div>
      </div>
      <div className="card text-sm">
        <h2 className="mb-2 font-semibold text-royal-800">Research categories</h2>
        <ul className="mb-2 list-disc pl-5">{cats.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
        <div className="flex gap-2"><input className="input" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} /><button className="btn-outline" disabled={!newCat} onClick={addCat}>Add</button></div>
      </div>
    </div>
  )
}

function ResultsTab({ setMsg }: { setMsg: (m: string) => void }) {
  const [results, setResults] = useState<any[]>([])
  const load = () => supabase.from('results').select('*').order('rank').then(({ data }) => setResults(data ?? []))
  useEffect(() => { load() }, [])
  return (
    <div className="space-y-4">
      <div className="card space-y-2 text-sm">
        <p>Publishing ranks the top 3 papers by the average of <b>approved</b> judge evaluations (₹15,000 / ₹10,000 / ₹5,000). Approve scores in the Submissions tab first.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-gold" onClick={async () => {
            if (!confirm('Publish results now? This replaces any previously published results.')) return
            const { data, error } = await supabase.rpc('publish_results')
            setMsg(error ? error.message : `Results published (${data} winners).`); load()
          }}>Publish results</button>
          <button className="btn-primary" onClick={async () => {
            const { data, error } = await supabase.rpc('issue_certificates')
            setMsg(error ? error.message : `${data} new participation certificates issued (winner certificates included).`)
          }}>Generate certificates</button>
        </div>
      </div>
      <Table cols={['rank', 'winner_name', 'research_title', 'category', 'final_score', 'prize_inr']} rows={results} />
    </div>
  )
}

function Audit() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows(data ?? []))
  }, [])
  return <Table cols={['created_at', 'action', 'entity', 'entity_id']} rows={rows.map((r) => ({ ...r, created_at: fmtDate(r.created_at) }))} />
}

function Table({ cols, rows }: { cols: string[]; rows: Record<string, any>[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-royal-50 text-royal-800"><tr>{cols.map((c) => <th key={c} className="px-3 py-2 capitalize">{c.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td className="px-3 py-4 text-slate-500" colSpan={cols.length}>No records.</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">{cols.map((c) => <td key={c} className="px-3 py-2">{String(r[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
