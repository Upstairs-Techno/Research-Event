import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, CheckCircle2, Clock3, FileText, Menu, X, LogOut, UserRound, LayoutDashboard, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Section = 'dashboard' | 'assigned' | 'pending' | 'accepted' | 'rejected' | 'history' | 'profile'
const sections: { id: Section; label: string; Icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard }, { id: 'assigned', label: 'Assigned Submissions', Icon: ClipboardList },
  { id: 'pending', label: 'Pending Reviews', Icon: Clock3 }, { id: 'accepted', label: 'Accepted Submissions', Icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected Submissions', Icon: X }, { id: 'history', label: 'Evaluation History', Icon: Activity }, { id: 'profile', label: 'My Profile', Icon: UserRound },
]

export default function JudgeDashboard() {
  const { user, signOut } = useAuth()
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [section, setSection] = useState<Section>('dashboard')
  const [drawer, setDrawer] = useState(false)
  const [query, setQuery] = useState('')
  const load = useCallback(async () => {
    if (!user) return
    const { data, error: assignmentError } = await supabase.from('judge_assignments')
      .select('id, submission_id, created_at, submissions(id,title,flagged,word_count,submitted_at,status,registrations(research_categories(name)))')
      .eq('judge_id', user.id).eq('status', 'active').order('created_at', { ascending: false })
    if (assignmentError) { setError(assignmentError.message); setRows([]); return }
    const ids = (data ?? []).map((a: any) => a.submission_id)
    const { data: evaluations, error: evalError } = ids.length
      ? await supabase.from('evaluations').select('submission_id,status,total,decision,feedback,rejection_reason,improvement_suggestions,evaluated_at,updated_at').eq('judge_id', user.id).in('submission_id', ids)
      : { data: [], error: null }
    if (evalError) { setError(evalError.message); setRows([]); return }
    const map = new Map((evaluations ?? []).map((e: any) => [e.submission_id, e]))
    setRows((data ?? []).map((a: any) => ({ ...a.submissions, assignment: a, evaluation: map.get(a.submission_id) ?? null })).filter((r: any) => r.id))
    setError('')
  }, [user])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel(`judge-assignments-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'judge_assignments', filter: `judge_id=eq.${user.id}` }, () => { void load() }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user, load])
  useEffect(() => {
    if (!drawer) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close)
  }, [drawer])

  const list = rows ?? []
  const completed = list.filter((r) => r.evaluation?.status === 'submitted')
  const pending = list.filter((r) => r.evaluation?.status !== 'submitted')
  const underReview = list.filter((r) => r.evaluation?.status === 'draft')
  const accepted = completed.filter((r) => r.evaluation?.decision === 'accepted')
  const rejected = completed.filter((r) => r.evaluation?.decision === 'rejected')
  const visible = useMemo(() => {
    let current = list
    if (section === 'pending') current = pending
    if (section === 'accepted') current = accepted
    if (section === 'rejected') current = rejected
    if (section === 'history') current = completed
    const q = query.trim().toLowerCase()
    return q ? current.filter((r) => `${r.title} ${r.id} ${r.registrations?.research_categories?.name ?? ''}`.toLowerCase().includes(q)) : current
  }, [section, list, pending, accepted, rejected, completed, query])
  const select = (next: Section) => { setSection(next); setDrawer(false); setQuery('') }
  if (!rows) return <p className="p-10 text-center text-slate-500">Loading assigned papers…</p>

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-5"><div><p className="text-xs font-bold uppercase tracking-wider text-gold-700">Research Distinction Awards</p><h1 className="mt-1 font-serif text-2xl font-bold text-royal-950 sm:text-3xl">Judge workspace</h1></div>
      <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-royal-900 lg:hidden" aria-label="Open judge navigation" onClick={() => setDrawer(true)}><Menu className="h-5 w-5"/></button>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {drawer && <button type="button" aria-label="Close navigation" onClick={() => setDrawer(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"/>}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,86vw)] bg-slate-50 p-4 shadow-2xl transition-transform duration-300 lg:sticky lg:top-20 lg:z-auto lg:h-fit lg:w-auto lg:translate-x-0 lg:bg-transparent lg:p-0 lg:shadow-none ${drawer ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav aria-label="Judge sections" className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2.5">{sections.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => select(id)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${section === id ? 'bg-royal-800 text-white' : 'text-slate-600 hover:bg-royal-50 hover:text-royal-900'}`}><Icon className="h-4 w-4"/>{label}</button>)}<button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-700"><LogOut className="h-4 w-4"/>Logout</button></nav>
      </aside>
      <main className="min-w-0 space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Unable to load your assignments: {error}</div>}
        {section === 'profile' ? <div className="card"><h2 className="font-serif text-xl font-bold text-royal-950">My Profile</h2><p className="mt-3 text-sm text-slate-600">{user?.email}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">Judge ID: {user?.id}</p></div> : <>
          {section === 'dashboard' && <><div><h2 className="font-serif text-xl font-bold text-royal-950">Dashboard overview</h2><p className="mt-1 text-sm text-slate-500">Your live assignment and evaluation progress.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
            ['Total assigned',list.length,FileText],['Pending reviews',list.filter((r) => !r.evaluation).length,Clock3],['Under review',underReview.length,Activity],['Accepted',accepted.length,CheckCircle2],['Rejected',rejected.length,X],['Completed evaluations',completed.length,CheckCircle2],
          ].map(([label,value,Icon]: any)=><div key={label} className="card flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 font-serif text-2xl font-bold text-royal-950">{value}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-royal-50 text-royal-800"><Icon className="h-5 w-5"/></span></div>)}</div></>}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-serif text-lg font-bold text-royal-950">{sections.find((s) => s.id === section)?.label}</h2><p className="mt-1 text-xs text-slate-500">{visible.length} paper{visible.length === 1 ? '' : 's'}</p></div><input className="input sm:max-w-xs" aria-label="Search papers" placeholder="Search paper or category" value={query} onChange={(e) => setQuery(e.target.value)}/></div>
            {visible.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No research papers have been assigned to you yet. Please check back later.</p> : <div className="divide-y divide-slate-100">{visible.map((s: any) => { const done = s.evaluation?.status === 'submitted'; const decision = s.evaluation?.decision; return <article key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><p className="break-words font-semibold text-royal-900">{s.title}</p><p className="mt-1 text-xs text-slate-500">{s.registrations?.research_categories?.name || 'Uncategorized'} · {s.word_count} words · Submitted {fmtDate(s.submitted_at)}</p><p className="mt-1 text-[11px] text-slate-400">Assigned {fmtDate(s.assignment?.created_at)} · ID {s.id}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`badge ${done ? decision === 'accepted' ? 'bg-emerald-100 text-emerald-800' : decision === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{done ? `${decision === 'rejected' ? 'Rejected' : decision === 'accepted' ? 'Accepted' : 'Submitted'} · ${s.evaluation.total}/100` : s.evaluation ? 'Draft saved' : 'Pending review'}</span><Link to={`/judge/${s.id}`} className="btn-primary whitespace-nowrap !py-2 !px-3 !text-xs">{done ? 'View evaluation' : 'Review Paper'}</Link></div></article> })}</div>}
          </section>
          {section === 'history' && completed.map((s: any) => <article key={`history-${s.id}`} className="card text-sm"><p className="font-semibold text-royal-900">{s.title} · {s.evaluation.decision}</p><p className="mt-1 text-slate-600">{s.evaluation.total}/100 · {fmtDate(s.evaluation.evaluated_at)}</p><p className="mt-2 whitespace-pre-wrap text-slate-600">{s.evaluation.feedback}</p>{s.evaluation.rejection_reason && <p className="mt-1 text-red-700">Reason: {s.evaluation.rejection_reason}</p>}<Link className="mt-2 inline-block text-royal-700 underline" to={`/judge/${s.id}`}>View evaluation details</Link></article>)}
        </>}
      </main>
    </div>
  </div>
}
