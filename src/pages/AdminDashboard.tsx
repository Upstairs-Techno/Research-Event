import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, rupees } from '../lib/utils'
import ReportPanel from '../components/ReportPanel'
import PaperView from '../components/PaperView'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  ShieldCheck,
  Award,
  Settings,
  History,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  FileDown,
  Unlock,
  UserCheck,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  Send,
  Sparkles,
  Trophy
} from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tab = 'overview' | 'registrations' | 'payments' | 'submissions' | 'judges' | 'results' | 'settings' | 'audit'

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
  { id: 'registrations', label: 'Participants', icon: Users },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'submissions', label: 'Review Submissions', icon: FileText },
  { id: 'judges', label: 'Judges Management', icon: ShieldCheck },
  { id: 'results', label: 'Results & Awards', icon: Award },
  { id: 'settings', label: 'Competition Settings', icon: Settings },
  { id: 'audit', label: 'Audit Trail', icon: History },
]

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

function downloadCsv(name: string, csv: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  a.click()
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showMsg = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setMsg({ text, type })
    window.setTimeout(() => setMsg(null), 6000)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Administrator Workspace
            </span>
            <span className="text-xs text-slate-400">Research Distinction Awards 2026</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-royal-950 mt-1">
            Competition Control Center
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden md:inline">
            Authorized Editorial &amp; Review Access
          </span>
        </div>
      </div>

      {/* Global Action / Notification Banner */}
      {msg && (
        <div
          role="status"
          className={`mt-4 flex items-center justify-between rounded-xl p-4 text-xs font-medium border ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Layout: Sidebar Navigation + Content Workspace */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Sidebar Nav */}
        <nav aria-label="Admin Sections" className="space-y-1 lg:sticky lg:top-20 lg:h-fit">
          <div className="rounded-2xl bg-white p-2.5 shadow-sm border border-slate-200 space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id)
                  setMsg(null)
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  tab === id
                    ? 'bg-royal-800 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-royal-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab === id ? 'text-gold-300' : 'text-slate-500'}`} />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Tab Content Canvas */}
        <main className="min-w-0 space-y-6">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'registrations' && <RegistrationsTab showMsg={showMsg} />}
          {tab === 'payments' && <PaymentsTab />}
          {tab === 'submissions' && <SubmissionsReviewTab showMsg={showMsg} />}
          {tab === 'judges' && <JudgesTab showMsg={showMsg} />}
          {tab === 'results' && <ResultsManagementTab showMsg={showMsg} />}
          {tab === 'settings' && <SettingsTab showMsg={showMsg} />}
          {tab === 'audit' && <AuditTrailTab />}
        </main>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. OVERVIEW & ANALYTICS TAB
   ───────────────────────────────────────────────────────────────────────────── */
function OverviewTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    supabase.rpc('admin_stats').then(({ data }) => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !stats) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-royal-200 border-t-royal-800" />
          <p className="text-xs text-slate-500">Loading competition metrics…</p>
        </div>
      </div>
    )
  }

  const metricCards = [
    { label: 'Registered Participants', val: stats.participants, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Submitted Papers', val: stats.submitted, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Awaiting Review', val: stats.pending_review, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Approved Papers', val: stats.approved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rejected Papers', val: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Incomplete Drafts', val: stats.drafts, icon: FileDown, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Paid Registrations', val: stats.paid, icon: CreditCard, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Completed Evaluations', val: stats.completed_evals, icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Competition Phase</span>
          <h3 className="font-serif text-lg font-bold text-royal-950 capitalize">
            {String(stats.competition_status).replace('_', ' ')}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Entry Fees</span>
            <p className="font-mono text-base font-bold text-emerald-700">{rupees(stats.revenue_paise || 0)}</p>
          </div>
          <button onClick={load} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metricCards.map(({ label, val, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
              <div className={`p-2 rounded-xl ${bg} ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-royal-950">
              {Number(val || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Category Distribution Breakdown */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-serif text-base font-bold text-royal-950">
          Participation by Research Category
        </h3>
        <div className="space-y-4">
          {stats.by_category?.map((c: any) => {
            const pct = stats.participants ? Math.round((c.count / stats.participants) * 100) : 0
            return (
              <div key={c.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="font-mono font-bold text-royal-900">{c.count} ({pct}%)</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-royal-600 to-gold-300"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. PARTICIPANTS MANAGEMENT TAB
   ───────────────────────────────────────────────────────────────────────────── */
function RegistrationsTab({ showMsg }: { showMsg: (m: string, t?: any) => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('registrations')
      .select('*, profiles(full_name, email), participants(*), research_categories(name), submissions(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows(data ?? [])
        setLoading(false)
      })
  }, [])

  const flat = rows.map((r) => {
    const s = r.submissions?.[0]
    const subStatus = s?.review_decision !== 'pending' ? s?.review_decision : s?.locked ? 'submitted' : 'draft'
    return {
      participant_id: r.participants?.participant_code || '—',
      name: r.profiles?.full_name || '—',
      email: r.profiles?.email || '—',
      mobile: r.participants?.mobile || '—',
      institution: r.participants?.institution || '—',
      country: r.participants?.country || '—',
      category: r.research_categories?.name || '—',
      title: r.research_title || '—',
      fee_status: r.status,
      submission_status: subStatus,
      registered_at: fmtDate(r.created_at),
    }
  })

  const filtered = rows.filter((r) => {
    const s = r.submissions?.[0]
    const subStatus = s?.review_decision !== 'pending' ? s?.review_decision : s?.locked ? 'submitted' : 'draft'
    const matchStatus = status === 'all' || subStatus === status
    const searchTarget = `${r.profiles?.full_name ?? ''} ${r.profiles?.email ?? ''} ${r.participants?.participant_code ?? ''} ${r.research_title ?? ''}`.toLowerCase()
    return matchStatus && searchTarget.includes(query.toLowerCase())
  })

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-royal-500"
              placeholder="Search participant name, email, code, title…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All Submission Statuses</option>
            <option value="draft">Draft (Incomplete)</option>
            <option value="submitted">Submitted (Locked)</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <button
          onClick={() => {
            downloadCsv('rda-participants-2026.csv', toCsv(flat))
            showMsg('Participants list exported to CSV.')
          }}
          className="btn-outline !py-2 !text-xs"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV ({filtered.length})
        </button>
      </div>

      {/* Participants Data Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-royal-50 text-royal-900 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Code / ID</th>
                <th className="px-4 py-3">Participant Name</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Submission</th>
                <th className="px-4 py-3">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No matching participants found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const s = r.submissions?.[0]
                  const subStatus = s?.review_decision !== 'pending' ? s?.review_decision : s?.locked ? 'submitted' : 'draft'
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-royal-800">
                        {r.participants?.participant_code || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{r.profiles?.full_name}</div>
                        <div className="text-[11px] text-slate-400">{r.profiles?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">
                        {r.participants?.institution || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.research_categories?.name}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          subStatus === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : subStatus === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : subStatus === 'submitted'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {subStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                        {fmtDate(r.created_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. RESEARCH PAPER REVIEW SYSTEM (MANDATORY REQUIREMENT)
   ───────────────────────────────────────────────────────────────────────────── */
function SubmissionsReviewTab({ showMsg }: { showMsg: (m: string, t?: any) => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [judges, setJudges] = useState<any[]>([])
  const [selectedSub, setSelectedSub] = useState<any | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [pickJudge, setPickJudge] = useState<Record<string, string>>({})

  // Form states for review decision
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved')
  const [rejectionReason, setRejectionReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*, profiles(full_name, email), registrations(abstract, research_categories(name), participants(*)), originality_reports(*), evaluations(*), judge_assignments(judge_id)')
      .eq('locked', true)
      .order('submitted_at', { ascending: false })

    setRows(data ?? [])

    const { data: j } = await supabase.from('judges').select('user_id, profiles(full_name, email)')
    setJudges(j ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openReviewModal = (s: any) => {
    setSelectedSub(s)
    setDecision(s.review_decision === 'rejected' ? 'rejected' : 'approved')
    setRejectionReason(s.rejection_reason || '')
    setFeedback(s.participant_feedback || '')
    setInternalNotes(s.internal_review_notes || '')
    setReviewModalOpen(true)
  }

  const handleReviewSubmit = async () => {
    if (!selectedSub) return
    if (decision === 'rejected' && !rejectionReason.trim()) {
      showMsg('A rejection reason is strictly required when rejecting a paper.', 'error')
      return
    }

    setSavingReview(true)
    const { error } = await supabase.rpc('admin_review_submission', {
      p_submission: selectedSub.id,
      p_decision: decision,
      p_rejection_reason: decision === 'rejected' ? rejectionReason.trim() : null,
      p_feedback: feedback.trim() || null,
      p_internal_notes: internalNotes.trim() || null,
    })
    setSavingReview(false)

    if (error) {
      showMsg(error.message, 'error')
      return
    }

    showMsg(
      decision === 'approved'
        ? 'Paper approved and participant notified.'
        : 'Paper rejected and participant notified with explanation.'
    )
    setReviewModalOpen(false)
    load()
  }

  const handleUnlock = async (subId: string) => {
    if (!confirm('Unlock this paper to allow the participant to edit and resubmit?')) return
    const { error } = await supabase.rpc('admin_unlock_submission', { p_submission: subId })
    if (error) {
      showMsg(error.message, 'error')
    } else {
      showMsg('Submission unlocked for participant editing.')
      load()
    }
  }

  const handleAssignJudge = async (subId: string, judgeId: string) => {
    if (!judgeId) return
    const { error } = await supabase.rpc('assign_judge', { p_submission: subId, p_judge: judgeId })
    if (error) {
      showMsg(error.message, 'error')
    } else {
      showMsg('Judge assigned successfully.')
      load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-royal-950">Submitted Research Papers</h2>
          <p className="text-xs text-slate-500">Read manuscripts, preview documents, and issue editorial decisions</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-royal-100 text-royal-800">
          {rows.length} Submitted Papers
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center border border-slate-200 text-slate-500 text-xs">
          No papers submitted for review yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => {
            const reports = s.originality_reports ?? []
            const submittedEvals = (s.evaluations ?? []).filter((e: any) => e.status === 'submitted')
            const avgScore = submittedEvals.length
              ? (submittedEvals.reduce((sum: number, e: any) => sum + Number(e.total), 0) / submittedEvals.length).toFixed(1)
              : null

            return (
              <div
                key={s.id}
                className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200/90 space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-royal-800 bg-royal-50 px-2.5 py-0.5 rounded-md border border-royal-200">
                        {s.registrations?.participants?.participant_code || 'ID'}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {s.registrations?.research_categories?.name}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {s.word_count} words (~{Math.ceil(s.word_count / 250)} pages)
                      </span>
                    </div>
                    <h3 className="font-serif text-base font-bold text-royal-950">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Author: <strong>{s.profiles?.full_name}</strong> ({s.profiles?.email}) · Submitted {fmtDate(s.submitted_at)}
                    </p>
                  </div>

                  {/* Decision Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    {s.review_decision === 'approved' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </span>
                    )}
                    {s.review_decision === 'rejected' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                        <XCircle className="w-3.5 h-3.5" /> Rejected
                      </span>
                    )}
                    {s.review_decision === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Awaiting Review
                      </span>
                    )}
                  </div>
                </div>

                {/* Juror & Evaluation Status */}
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {(s.judge_assignments ?? []).length} Juror(s) Assigned
                  </span>
                  {avgScore && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                      Avg Juror Score: {avgScore}/100
                    </span>
                  )}
                  {s.flagged && (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                      Flagged Telemetry
                    </span>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Open Full Reader & Review Modal */}
                    <button
                      onClick={() => openReviewModal(s)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-royal-800 text-white hover:bg-royal-700 transition-all shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> Open &amp; Review Paper
                    </button>

                    <button
                      onClick={() => handleUnlock(s.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      title="Unlock paper to let participant edit again"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Unlock
                    </button>
                  </div>

                  {/* Judge Assignment Dropdown */}
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs bg-white focus:outline-none"
                      value={pickJudge[s.id] || ''}
                      onChange={(e) => setPickJudge({ ...pickJudge, [s.id]: e.target.value })}
                    >
                      <option value="">Assign Juror…</option>
                      {judges.map((j) => (
                        <option key={j.user_id} value={j.user_id}>
                          {j.profiles?.full_name || j.profiles?.email}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!pickJudge[s.id]}
                      onClick={() => handleAssignJudge(s.id, pickJudge[s.id])}
                      className="btn-outline !py-1.5 !px-3 !text-xs disabled:opacity-40"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FULL RESEARCH PAPER READER & REVIEW DECISION MODAL
          ───────────────────────────────────────────────────────────── */}
      {reviewModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-royal-950 text-white">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold-300">
                  Academic Paper Review &amp; Evaluation
                </span>
                <h3 className="font-serif text-lg font-bold text-white truncate max-w-xl">
                  {selectedSub.title}
                </h3>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Two column layout (Document Reader + Review Decision) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Paper Details Card */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Author:</span>
                  <span className="font-bold text-royal-950">{selectedSub.profiles?.full_name} ({selectedSub.profiles?.email})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-semibold text-royal-900">{selectedSub.registrations?.research_categories?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Length:</span>
                  <span className="font-mono font-bold text-royal-900">{selectedSub.word_count} words (~{Math.ceil(selectedSub.word_count / 250)} pages)</span>
                </div>
                {selectedSub.registrations?.abstract && (
                  <div className="pt-2 border-t border-slate-200">
                    <strong className="text-slate-700 block mb-1">Registered Abstract:</strong>
                    <p className="text-slate-600 leading-relaxed italic">{selectedSub.registrations.abstract}</p>
                  </div>
                )}
              </div>

              {/* Complete Manuscript Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-royal-800">
                    Full Manuscript Content
                  </h4>
                  <button
                    onClick={() => {
                      const paperHtml = document.getElementById(`modal-paper-${selectedSub.id}`)?.innerHTML
                      const w = window.open('', '_blank')
                      if (!w || !paperHtml) return
                      w.document.write(`<!doctype html><title>${selectedSub.title}</title><style>body{font:12pt/1.7 Georgia,serif;max-width:760px;margin:48px auto;padding:0 24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px}img{max-width:100%}</style><h1>${selectedSub.title}</h1>${paperHtml}<script>onload=()=>print()</script>`)
                      w.document.close()
                    }}
                    className="btn-outline !py-1 !text-xs"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Save / Print PDF
                  </button>
                </div>
                <div
                  id={`modal-paper-${selectedSub.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 max-h-[420px] overflow-y-auto shadow-inner"
                >
                  <PaperView content={selectedSub.content} />
                </div>
              </div>

              {/* Originality Reports Summary */}
              {selectedSub.originality_reports?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-royal-800">
                    Originality &amp; Plagiarism Telemetry
                  </h4>
                  <ReportPanel reports={selectedSub.originality_reports} />
                </div>
              )}

              {/* Review Decision Form */}
              <div className="rounded-2xl bg-royal-50/70 p-5 border border-royal-200 space-y-4">
                <h4 className="font-serif text-base font-bold text-royal-950">
                  Issue Editorial Decision
                </h4>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value="approved"
                      checked={decision === 'approved'}
                      onChange={() => setDecision('approved')}
                      className="accent-emerald-600"
                    />
                    Approve Paper
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-red-800 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      value="rejected"
                      checked={decision === 'rejected'}
                      onChange={() => setDecision('rejected')}
                      className="accent-red-600"
                    />
                    Reject Paper
                  </label>
                </div>

                {decision === 'rejected' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-red-800 block">
                      Required Rejection Reason <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Specify the academic reason for rejection (e.g. out of scope, does not meet academic rigor, plagiarism threshold exceeded)…"
                      className="w-full rounded-xl border border-red-300 p-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                    <p className="text-[10px] text-red-600">
                      This explanation is displayed directly in the participant dashboard and sent in the rejection email.
                    </p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                      Participant Feedback (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Constructive notes visible to the participant…"
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                      Internal Committee Notes
                    </label>
                    <textarea
                      rows={2}
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Private notes for jury &amp; administrators only…"
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-royal-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="btn-outline !py-2 !text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={handleReviewSubmit}
                    className={`btn !py-2 !text-xs ${
                      decision === 'approved' ? 'btn-primary' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {savingReview ? 'Recording Decision…' : decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. PAYMENTS TAB
   ───────────────────────────────────────────────────────────────────────────── */
function PaymentsTab() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from('payments')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [])

  const flat = rows.map((p) => ({
    name: p.profiles?.full_name || '—',
    email: p.profiles?.email || '—',
    amount: rupees(p.amount_paise),
    status: p.status,
    order_id: p.razorpay_order_id,
    payment_id: p.razorpay_payment_id || '—',
    paid_at: p.paid_at ? fmtDate(p.paid_at) : '—',
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-bold text-royal-950">Registration Payments Ledger</h2>
        <button
          onClick={() => downloadCsv('rda-payments-2026.csv', toCsv(flat))}
          className="btn-outline !py-2 !text-xs"
        >
          <Download className="w-3.5 h-3.5" /> Export Payments CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-royal-50 text-royal-900 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Payment ID</th>
                <th className="px-4 py-3">Paid Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flat.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                flat.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400">{p.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-royal-900">{p.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{p.order_id}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{p.payment_id}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{p.paid_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. RESULTS & AWARDS MANAGEMENT TAB (MANDATORY REQUIREMENT)
   ───────────────────────────────────────────────────────────────────────────── */
function ResultsManagementTab({ showMsg }: { showMsg: (m: string, t?: any) => void }) {
  const [results, setResults] = useState<any[]>([])
  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: res }, { data: settings }] = await Promise.all([
      supabase.from('results').select('*').order('rank'),
      supabase.from('competition_settings').select('results_published').eq('id', 1).single(),
    ])
    setResults(res ?? [])
    setIsPublished(!!settings?.results_published)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handlePublishResults = async () => {
    if (!confirm('Publish official results now? This ranks the top 3 papers by average approved scores and reveals winners to participants.')) {
      return
    }
    const { data, error } = await supabase.rpc('publish_results')
    if (error) {
      showMsg(error.message, 'error')
    } else {
      showMsg(`Results published successfully with ${data} winner podium placements!`)
      load()
    }
  }

  const handleIssueCertificates = async () => {
    const { data, error } = await supabase.rpc('issue_certificates')
    if (error) {
      showMsg(error.message, 'error')
    } else {
      showMsg(`${data} verifiable certificates generated and issued to participants!`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Public Visibility</span>
            <h2 className="font-serif text-lg font-bold text-royal-950 flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-600" />
              Competition Results &amp; Awards Control
            </h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            isPublished
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-amber-100 text-amber-800 border-amber-200'
          }`}>
            {isPublished ? '● Officially Published' : 'Hidden from Participants (Pre-release)'}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
          Publishing ranks the top 3 research papers by the average of approved juror evaluations (Cash awards: 1st: ₹15,000 · 2nd: ₹10,000 · 3rd: ₹5,000). Ensure all scores are approved in the Submissions tab before publishing.
        </p>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          <button onClick={handlePublishResults} className="btn-gold !py-2.5">
            <Trophy className="w-4 h-4" />
            Publish Official Results
          </button>
          <button onClick={handleIssueCertificates} className="btn-primary !py-2.5">
            <Award className="w-4 h-4" />
            Generate &amp; Issue Certificates
          </button>
        </div>
      </div>

      {/* Winners Table */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-serif text-base font-bold text-royal-950">
          Rankings &amp; Award Recipients
        </h3>

        {results.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No published results yet. Click "Publish Official Results" above after evaluating submissions.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-royal-50 text-royal-900 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Award Winner</th>
                  <th className="px-4 py-3">Research Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Final Score</th>
                  <th className="px-4 py-3">Prize Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-royal-950">
                      #{r.rank}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{r.winner_name}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{r.research_title}</td>
                    <td className="px-4 py-3 text-slate-600">{r.category}</td>
                    <td className="px-4 py-3 font-mono font-bold text-royal-800">{r.final_score}/100</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{r.prize_inr?.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. JUDGES MANAGEMENT TAB
   ───────────────────────────────────────────────────────────────────────────── */
function JudgesTab({ showMsg }: { showMsg: (m: string, t?: any) => void }) {
  const [email, setEmail] = useState('')
  const [judges, setJudges] = useState<any[]>([])

  const load = useCallback(() => {
    supabase
      .from('judges')
      .select('user_id, profiles(full_name, email)')
      .then(({ data }) => setJudges(data ?? []))
  }, [])

  useEffect(load, [load])

  const setRole = async (role: 'judge' | 'participant') => {
    const { error } = await supabase.rpc('admin_set_role', { p_email: email.trim(), p_role: role })
    if (error) {
      showMsg(error.message, 'error')
    } else {
      showMsg(`User role updated to ${role}.`)
      setEmail('')
      load()
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <h2 className="font-serif text-base font-bold text-royal-950">
          Promote Juror / Reviewer
        </h2>
        <p className="text-xs text-slate-600">
          Enter the registered email of an academic peer to grant them Juror access to evaluate assigned research papers.
        </p>

        <div className="flex flex-wrap items-end gap-3 max-w-xl">
          <div className="flex-1 min-w-[240px]">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juror@university.edu"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-royal-500"
            />
          </div>
          <button
            disabled={!email.trim()}
            onClick={() => setRole('judge')}
            className="btn-primary !py-2.5 !text-xs"
          >
            Grant Judge Role
          </button>
          <button
            disabled={!email.trim()}
            onClick={() => setRole('participant')}
            className="btn-outline !py-2.5 !text-xs"
          >
            Demote
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-3">
        <h3 className="font-serif text-base font-bold text-royal-950">Active Jurors</h3>
        {judges.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No jurors registered yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-xs">
            {judges.map((j) => (
              <li key={j.user_id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-royal-900">{j.profiles?.full_name}</span>
                  <span className="text-slate-500 ml-2">({j.profiles?.email})</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                  Academic Juror
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. SETTINGS TAB
   ───────────────────────────────────────────────────────────────────────────── */
function SettingsTab({ showMsg }: { showMsg: (m: string, t?: any) => void }) {
  const [s, setS] = useState<any>(null)
  const [rubric, setRubric] = useState('')
  const [cats, setCats] = useState<any[]>([])
  const [newCat, setNewCat] = useState('')

  useEffect(() => {
    supabase
      .from('competition_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setS(data)
        setRubric(JSON.stringify(data?.rubric ?? [], null, 2))
      })
    supabase.from('research_categories').select('*').then(({ data }) => setCats(data ?? []))
  }, [])

  if (!s) return <p className="text-xs text-slate-500 p-6">Loading configuration…</p>

  const save = async () => {
    let parsed
    try {
      parsed = JSON.parse(rubric)
    } catch {
      showMsg('Scoring rubric must be valid JSON.', 'error')
      return
    }
    const total = parsed.reduce((n: number, r: any) => n + Number(r.weight), 0)
    if (total !== 100) {
      showMsg(`Rubric weights must sum to exactly 100 (current total: ${total}).`, 'error')
      return
    }

    const { error } = await supabase
      .from('competition_settings')
      .update({
        name: s.name,
        fee_paise: s.fee_paise,
        registration_open: s.registration_open,
        refund_policy: s.refund_policy,
        submission_deadline: s.submission_deadline,
        competition_starts_at: s.competition_starts_at,
        competition_ends_at: s.competition_ends_at,
        results_announcement_at: s.results_announcement_at,
        rubric: parsed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) {
      showMsg(error.message, 'error')
    } else {
      showMsg('Competition settings saved successfully.')
    }
  }

  const addCat = async () => {
    const slug = newCat.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const { error } = await supabase.from('research_categories').insert({ name: newCat, slug })
    if (error) {
      showMsg(error.message, 'error')
    } else {
      showMsg(`Category "${newCat}" created.`)
      setNewCat('')
      supabase.from('research_categories').select('*').then(({ data }) => setCats(data ?? []))
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <h2 className="font-serif text-lg font-bold text-royal-950">Competition Dates &amp; Parameters</h2>
        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Competition Name
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none"
              value={s.name}
              onChange={(e) => setS({ ...s, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Registration Fee (Paise; 49900 = ₹499)
            </label>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none"
              value={s.fee_paise}
              onChange={(e) => setS({ ...s, fee_paise: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Competition Starts (ISO / IST)
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none"
              value={s.competition_starts_at ? new Date(new Date(s.competition_starts_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => setS({ ...s, competition_starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Competition Ends / Deadline (ISO / IST)
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none"
              value={s.competition_ends_at ? new Date(new Date(s.competition_ends_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => setS({ ...s, competition_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer pt-2 text-xs font-bold text-royal-900">
              <input
                type="checkbox"
                checked={s.registration_open}
                onChange={(e) => setS({ ...s, registration_open: e.target.checked })}
                className="h-4 w-4 rounded accent-royal-800"
              />
              Accept New Registrations (Registration Open)
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Evaluation Scoring Rubric (JSON, Weights sum = 100)
            </label>
            <textarea
              rows={8}
              className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs focus:outline-none"
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <button onClick={save} className="btn-primary !py-2.5 !text-xs">
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-3">
        <h3 className="font-serif text-base font-bold text-royal-950">Active Research Categories</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {cats.map((c) => (
            <span key={c.id} className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-medium">
              {c.name}
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-md pt-2">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none"
            placeholder="New Category Name"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <button onClick={addCat} disabled={!newCat.trim()} className="btn-outline !py-2 !text-xs">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. AUDIT TRAIL TAB
   ───────────────────────────────────────────────────────────────────────────── */
function AuditTrailTab() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setRows(data ?? []))
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-lg font-bold text-royal-950">System Audit Trail</h2>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-royal-50 text-royal-900 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-royal-900">{r.action}</td>
                  <td className="px-4 py-3 text-slate-600">{r.entity}</td>
                  <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">{r.entity_id}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[10px] max-w-xs truncate">
                    {JSON.stringify(r.details || {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
