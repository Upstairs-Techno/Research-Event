import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Search, ShieldCheck, Users } from 'lucide-react'
import { fmtDate } from '../lib/utils'
import { supabase } from '../lib/supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */
const PAGE_SIZE = 10

export default function AdminJudgeDetails() {
  const { judgeId } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'evaluated' | 'completed'>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setData(null)
    supabase.functions.invoke('admin-judge-management', { body: { action: 'details', userId: judgeId } })
      .then(async ({ data: result, error: invokeError }) => {
        if (!active) return
        if (invokeError || result?.error) {
          let message = result?.error as string | undefined
          if (invokeError && !message) {
            try { message = (await (invokeError as any).context?.json())?.error } catch { /* use the Functions client message */ }
          }
          setError(message || invokeError?.message || 'Could not load judge details.')
        } else setData(result)
        setLoading(false)
      })
      .catch((reason) => {
        if (active) { setError(reason instanceof Error ? reason.message : 'Could not load judge details.'); setLoading(false) }
      })
    return () => { active = false }
  }, [judgeId])

  const participants = data?.participants ?? []
  const filtered = useMemo(() => participants.filter((row: any) => {
    const matchesFilter = filter === 'all' || (filter === 'evaluated' ? row.evaluation_status === 'evaluated' || row.evaluation_status === 'completed' : row.evaluation_status === filter)
    const text = `${row.participant_name} ${row.participant_id} ${row.participant_email} ${row.research_title} ${row.category}`.toLowerCase()
    return matchesFilter && text.includes(query.trim().toLowerCase())
  }), [participants, filter, query])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const stats = data?.statistics

  const cards = stats ? [
    { label: 'Participants assigned', value: stats.assigned_participants, detail: 'Unique participants', Icon: Users, tone: 'text-royal-800 bg-royal-50' },
    { label: 'Evaluated', value: stats.evaluated_participants, detail: 'Evaluation submitted', Icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Pending', value: stats.pending_participants, detail: 'Awaiting submission', Icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Completed', value: stats.completed_participants, detail: 'Approved by admin', Icon: ShieldCheck, tone: 'text-violet-700 bg-violet-50' },
    { label: 'Papers assigned', value: stats.assigned_papers, detail: `${stats.pending_papers} pending`, Icon: FileText, tone: 'text-sky-700 bg-sky-50' },
    { label: 'Papers evaluated', value: stats.evaluated_papers, detail: `${stats.completed_papers} approved`, Icon: Activity, tone: 'text-orange-700 bg-orange-50' },
  ] : []

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <Link to="/admin" state={{ adminTab: 'judges' }} className="inline-flex items-center gap-2 text-xs font-bold text-royal-700 hover:text-royal-900"><ArrowLeft className="h-4 w-4"/>Back to Judge Management</Link>
    {loading ? <div className="card py-16 text-center text-sm text-slate-500">Loading judge profile and assigned evaluation data…</div> : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div> : data && <>
      <header className="rounded-2xl border border-royal-800 bg-gradient-to-r from-royal-950 to-royal-800 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div><span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-300"><ShieldCheck className="h-3.5 w-3.5"/>Judge Profile</span><h1 className="mt-3 font-serif text-2xl font-bold sm:text-3xl">{data.judge.full_name}</h1><p className="mt-1 text-sm text-white/70">{data.judge.expertise || 'Judge'} · {data.judge.email}</p></div>
          <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${data.judge.account_active ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-white/20 bg-white/10 text-white/70'}`}>{data.judge.account_active ? 'Active account' : 'Inactive account'}</span>
        </div>
        <div className="mt-6 grid gap-3 border-t border-white/15 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <ProfileValue label="Judge ID" value={data.judge.id} mono/><ProfileValue label="Contact number" value={data.judge.contact_number || 'Not provided in profile'}/><ProfileValue label="Account created" value={fmtDate(data.judge.created_at)}/><ProfileValue label="Last sign in" value={fmtDate(data.judge.last_sign_in_at)}/>
        </div>
      </header>

      <section aria-label="Judge performance statistics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, detail, Icon, tone }: any) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4"/></span></div><p className="mt-3 font-serif text-2xl font-bold text-royal-950">{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>)}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
          <div><h2 className="font-serif text-lg font-bold text-royal-950">Assigned Participants &amp; Papers</h2><p className="mt-1 text-xs text-slate-500">Only records assigned to this judge are shown. Each row represents one assigned research paper.</p></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input aria-label="Search assigned participants" className="input pl-9" placeholder="Search participant, email, paper, or category" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }}/></div>
            <select aria-label="Filter participants by evaluation status" className="input" value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(1) }}><option value="all">All Participants</option><option value="pending">Pending Evaluation</option><option value="evaluated">Evaluated</option><option value="completed">Completed</option></select>
          </div>
        </div>
        {pageRows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No assigned participants match this filter.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-xs">
          <thead className="bg-royal-50 text-[10px] font-bold uppercase tracking-wider text-royal-900"><tr><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Participant ID</th><th className="px-4 py-3">Research Paper</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Submission Date</th><th className="px-4 py-3">Evaluation</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Evaluation Date</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{pageRows.map((row: any) => <tr key={row.submission_id} className="align-top hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.participant_name}</p><p className="mt-1 text-[11px] text-slate-500">{row.participant_email || '—'}</p></td><td className="px-4 py-3 font-mono text-[10px] text-slate-600">{row.participant_id}</td><td className="max-w-[240px] whitespace-normal px-4 py-3 font-medium text-slate-800">{row.research_title}</td><td className="px-4 py-3 text-slate-600">{row.category}</td><td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(row.submitted_at)}</td><td className="px-4 py-3"><StatusBadge status={row.evaluation_status}/></td><td className="px-4 py-3 font-mono font-bold text-royal-800">{row.evaluation_score == null ? '—' : `${row.evaluation_score}/100`}</td><td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(row.evaluation_date)}</td></tr>)}</tbody>
        </table></div>}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-500">{filtered.length ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}` : '0 results'}</span><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/></button><span className="text-slate-600">Page {safePage} of {pageCount}</span><button type="button" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4"/></button></div></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-gold-600"/><h2 className="font-serif text-lg font-bold text-royal-950">Recent Evaluation Activity</h2></div>{data.recent_evaluations.length === 0 ? <p className="text-xs text-slate-500">No evaluations have been submitted by this judge yet.</p> : <ol className="divide-y divide-slate-100">{data.recent_evaluations.map((row: any) => <li key={row.submission_id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-slate-800">{row.participant_name} <span className="font-normal text-slate-500">· {row.research_title}</span></p><p className="mt-1 text-[11px] text-slate-500">{fmtDate(row.evaluation_date)}</p></div><div className="flex items-center gap-2"><StatusBadge status={row.evaluation_status}/><span className="font-mono text-xs font-bold text-royal-800">{row.evaluation_score}/100</span></div></li>)}</ol>}</section>
    </>}
  </div>
}

function ProfileValue({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</p><p className={`mt-1 break-all text-white/90 ${mono ? 'font-mono text-[10px]' : ''}`}>{value || '—'}</p></div>
}

function StatusBadge({ status }: { status: 'pending' | 'evaluated' | 'completed' }) {
  const style = status === 'completed' ? 'bg-emerald-100 text-emerald-800' : status === 'evaluated' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
  const label = status === 'completed' ? 'Completed' : status === 'evaluated' ? 'Evaluated' : 'Pending'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${style}`}>{label}</span>
}
