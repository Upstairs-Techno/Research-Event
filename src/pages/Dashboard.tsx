import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProgressTracker from '../components/ProgressTracker'
import { fmtDate, useSettings } from '../lib/utils'
import {
  FileText,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Award,
  Bell,
  ArrowRight,
  ExternalLink,
  BookOpen,
  User,
  Building,
  GraduationCap,
  Download,
  Eye,
  Edit3,
  HelpCircle,
  Sparkles,
  Trophy
} from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Dashboard() {
  const { user, fullName } = useAuth()
  const nav = useNavigate()
  const settings = useSettings()

  const [reg, setReg] = useState<any>(null)
  const [sub, setSub] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [evals, setEvals] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [certs, setCerts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'paper' | 'schedule' | 'results' | 'notifications'>('overview')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: r } = await supabase
        .from('registrations')
        .select('*, participants(*), research_categories(name)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!r) {
        nav('/complete-registration', { replace: true })
        return
      }
      setReg(r)

      const { data: s } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      setSub(s)

      if (s) {
        const [{ data: rep }, { data: ev }, { data: res }] = await Promise.all([
          supabase
            .from('originality_reports')
            .select('kind, status, score')
            .eq('submission_id', s.id)
            .order('created_at', { ascending: false }),
          supabase.from('evaluations').select('total, feedback').eq('submission_id', s.id),
          supabase.from('results').select('*').eq('submission_id', s.id).maybeSingle(),
        ])
        setReports(rep ?? [])
        setEvals(ev ?? [])
        setResult(res)
      }

      const { data: c } = await supabase.from('certificates').select('*').eq('user_id', user.id)
      setCerts(c ?? [])

      const { data: n } = await supabase
        .from('participant_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(n ?? [])
      setReady(true)
    })()
  }, [user, nav])

  // Real-time notifications subscription
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`participant-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participant_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((current) => [payload.new, ...current].slice(0, 20))
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  if (!ready || !reg) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-royal-200 border-t-royal-800" />
          <p className="text-sm font-medium text-slate-500">Loading your participant dashboard…</p>
        </div>
      </div>
    )
  }

  const paid = reg.status === 'paid'
  const submitted = !!sub?.locked
  const published = !!settings?.results_published

  // Progression index
  // 0: Registration, 1: Payment, 2: Research Writing, 3: Submission, 4: Evaluation, 5: Results
  let stepIndex = 0
  if (!paid) {
    stepIndex = 1
  } else if (!submitted) {
    stepIndex = 2
  } else if (sub?.review_decision === 'approved' || sub?.status === 'evaluated') {
    stepIndex = published ? 5 : 4
  } else if (sub?.review_decision === 'rejected') {
    stepIndex = 4
  } else {
    stepIndex = 3
  }

  // Submission status derivation
  const getSubmissionStatus = () => {
    if (!sub) return { label: 'Not Started', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: HelpCircle }
    if (published) return { label: 'Results Announced', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Trophy }
    if (sub.review_decision === 'rejected') return { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle }
    if (sub.review_decision === 'approved') return { label: 'Approved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 }
    if (sub.locked) {
      if (sub.status === 'under_review') return { label: 'Under Review', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock }
      return { label: 'Submitted', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle2 }
    }
    return { label: 'Draft', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Edit3 }
  }

  const statusInfo = getSubmissionStatus()
  const StatusIcon = statusInfo.icon

  // Page count estimation (250 words/page)
  const wordsCount = sub?.word_count ?? 0
  const estimatedPages = Math.max(1, Math.ceil(wordsCount / 250))
  const meetsPageRequirement = wordsCount >= 750

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. WELCOME HEADER & PARTICIPANT HERO
          ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-royal-900 via-royal-800 to-royal-900 p-6 sm:p-8 text-white shadow-xl border border-gold-500/40">
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gold-500/20 text-gold-300 border border-gold-500/40">
                <Sparkles className="w-3.5 h-3.5" />
                Participant Portal
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-white border border-white/15">
                ID: {reg.participants?.participant_code || 'RDA-PENDING'}
              </span>
              {paid ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Registration Paid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Payment Required
                </span>
              )}
            </div>

            <h1 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Welcome, {fullName}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Building className="w-4 h-4 text-gold-300" />
                {reg.participants?.institution || 'Institution Not Specified'}
              </span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-gold-300" />
                {reg.participants?.qualification || 'Researcher'}
              </span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-gold-300" />
                Category: <strong className="text-white">{reg.research_categories?.name}</strong>
              </span>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch md:items-center shrink-0">
            {!paid ? (
              <Link
                to="/payment"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gold-300 text-royal-900 hover:bg-gold-100 shadow-lg transition-all font-heading"
              >
                Complete Payment (₹499)
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/editor"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gold-300 text-royal-900 hover:bg-gold-100 shadow-lg transition-all font-heading"
              >
                {submitted ? (
                  <>
                    <Eye className="w-4 h-4" /> View Submitted Paper
                  </>
                ) : sub ? (
                  <>
                    <Edit3 className="w-4 h-4" /> Continue Writing
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" /> Start Writing Paper
                  </>
                )}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. COMPETITION SCHEDULE & LIVE COUNTDOWN
          ───────────────────────────────────────────────────────────── */}
      <CompetitionScheduleCard settings={settings} />

      {/* ─────────────────────────────────────────────────────────────
          3. REJECTION OR APPROVAL ALERTS (MANDATORY REQUIREMENT)
          ───────────────────────────────────────────────────────────── */}
      {sub?.review_decision === 'rejected' && (
        <section
          role="alert"
          className="rounded-2xl border-2 border-red-300 bg-red-50/90 p-6 sm:p-7 shadow-sm transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 border border-red-200">
              <XCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-700">Review Decision</span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-red-950">
                  Your Research Paper was Not Selected
                </h2>
              </div>

              {/* Exact required rejection message */}
              <p className="text-sm text-red-900 font-medium leading-relaxed bg-white/70 p-4 rounded-xl border border-red-200/80">
                Thank you for participating in Research Distinction Awards. Unfortunately, your research paper was not selected for this competition. Better luck next time!
              </p>

              {sub.rejection_reason && (
                <div className="rounded-xl bg-white p-4 border border-red-200 text-xs text-red-950 space-y-1">
                  <p className="font-bold text-red-800 uppercase tracking-wider text-[11px]">
                    Reason for Rejection:
                  </p>
                  <p className="whitespace-pre-wrap text-slate-700">{sub.rejection_reason}</p>
                </div>
              )}

              {sub.participant_feedback && (
                <div className="rounded-xl bg-white p-4 border border-red-200 text-xs text-slate-800 space-y-1">
                  <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Reviewer Feedback:
                  </p>
                  <p className="whitespace-pre-wrap text-slate-600">{sub.participant_feedback}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {sub?.review_decision === 'approved' && (
        <section
          role="status"
          className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-6 sm:p-7 shadow-sm transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-2 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Review Decision</span>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-emerald-950">
                Research Paper Approved!
              </h2>
              <p className="text-sm text-emerald-900 leading-relaxed">
                Congratulations! Your research paper has met the editorial requirements and has been formally approved for competitive jury evaluation.
              </p>
              {sub.participant_feedback && (
                <div className="mt-3 rounded-xl bg-white p-4 border border-emerald-200 text-xs text-slate-800 space-y-1">
                  <p className="font-bold text-emerald-800 uppercase tracking-wider text-[11px]">
                    Reviewer Commendations &amp; Feedback:
                  </p>
                  <p className="whitespace-pre-wrap text-slate-700">{sub.participant_feedback}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. 6-STAGE INTERACTIVE PROGRESS TRACKER
          ───────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80">
        <ProgressTracker current={stepIndex} />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. MAIN DASHBOARD CONTENT GRID
          ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Research Paper Overview (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Research Paper Status Card */}
          <div className="rounded-2xl bg-white p-6 sm:p-7 shadow-sm border border-slate-200/80 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal-50 text-royal-800 border border-royal-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-royal-950">
                    Research Paper Overview
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live manuscript metrics, structure, and editorial status
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusInfo.label}
                </span>
              </div>
            </div>

            {/* Registered Title & Abstract */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Registered Topic &amp; Title</span>
              <h3 className="font-serif text-base sm:text-lg font-bold text-royal-900 leading-snug">
                {sub?.title || reg.research_title}
              </h3>
              {reg.abstract && (
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <strong className="text-slate-800">Abstract Summary:</strong> {reg.abstract}
                </p>
              )}
            </div>

            {/* Writing Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Word Count</span>
                <p className="font-mono text-lg font-bold text-royal-900 mt-0.5">
                  {wordsCount.toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">Min 750 words</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Page Count</span>
                <p className="font-mono text-lg font-bold text-royal-900 mt-0.5">
                  {estimatedPages} <span className="text-xs font-normal text-slate-500">/ 3 min</span>
                </p>
                <span className="text-[10px] text-slate-500">~250 words/page</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Min Requirement</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {meetsPageRequirement ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Met (≥3 pgs)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                      <AlertCircle className="w-3.5 h-3.5" /> Incomplete
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">{meetsPageRequirement ? 'Eligible to submit' : `${750 - wordsCount} words needed`}</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Saved</span>
                <p className="text-xs font-semibold text-royal-900 mt-1 truncate">
                  {sub?.updated_at ? fmtDate(sub.updated_at) : 'Not saved yet'}
                </p>
                <span className="text-[10px] text-slate-500">{sub?.locked ? 'Final version' : 'Autosave active'}</span>
              </div>
            </div>

            {/* Minimum Requirement Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  Submission Requirement Progress ({Math.min(100, Math.round((wordsCount / 750) * 100))}%)
                </span>
                <span className="font-semibold text-royal-800">
                  {wordsCount} / 750 words (min. 3 pages)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    meetsPageRequirement ? 'bg-emerald-500' : 'bg-gold-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, (wordsCount / 750) * 100))}%` }}
                />
              </div>
            </div>

            {/* Paper CTA & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {submitted
                  ? 'Your paper is securely submitted and locked against further modifications.'
                  : 'You can draft, format, preview, and save your paper at any time.'}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/editor"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-royal-800 hover:bg-royal-700 text-white shadow-sm transition-all"
                >
                  {submitted ? (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Open in Document Viewer
                    </>
                  ) : sub ? (
                    <>
                      <Edit3 className="w-3.5 h-3.5" /> Open Research Editor
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3.5 h-3.5" /> Launch Research Editor
                    </>
                  )}
                </Link>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              RESULTS & AWARDS SECTION (MANDATORY REQUIREMENT)
              ───────────────────────────────────────────────────────── */}
          <div className="rounded-2xl bg-white p-6 sm:p-7 shadow-sm border border-slate-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-royal-900 border border-gold-300">
                  <Award className="w-5 h-5 text-gold-600" />
                </div>
                <div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-royal-950">
                    Competition Results &amp; Awards
                  </h2>
                  <p className="text-xs text-slate-500">
                    Official evaluation rankings, awards podium, and juror assessments
                  </p>
                </div>
              </div>

              {published ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Official Results Published
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  Release: December 2026
                </span>
              )}
            </div>

            {/* If Results Are NOT Published Yet */}
            {!published ? (
              <div className="rounded-xl bg-slate-50 p-6 text-center border border-slate-200/80 space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal-100 text-royal-800">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-base font-bold text-royal-900">
                  Results Awaiting Official Announcement
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  The editorial committee and peer evaluation jury are reviewing all submissions. Official rankings, commendations, and cash award announcements will be published in <strong>December 2026</strong>.
                </p>
              </div>
            ) : (
              /* If Results ARE Published */
              <div className="space-y-4">
                {/* Winner Card if User Won */}
                {result && (
                  <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-gold-100 to-amber-200/30 p-6 border-2 border-gold-500 text-royal-950 shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-royal-950 shadow-md">
                        <Trophy className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Award Recipient</span>
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-royal-950">
                          🏆 Congratulations — Rank {result.rank} Award Winner!
                        </h3>
                        <p className="text-xs sm:text-sm text-royal-800">
                          Cash Prize Awarded: <strong>₹{result.prize_inr?.toLocaleString('en-IN')}</strong> · Final Score: <strong>{result.final_score}/100</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-600">
                    Explore the complete podium of winners across all categories:
                  </p>
                  <Link
                    to="/results"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-royal-700 hover:text-royal-900 hover:underline"
                  >
                    View Official Results Page
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Judge Feedback & Scoring */}
                {evals.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Juror Evaluations &amp; Feedback
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {evals.map((e, idx) => (
                        <div key={idx} className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-royal-900">Juror Evaluation #{idx + 1}</span>
                            <span className="font-mono font-bold px-2 py-0.5 rounded bg-royal-100 text-royal-800">
                              {e.total}/100 pts
                            </span>
                          </div>
                          <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {e.feedback || 'No written critique provided.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Entry Details, Notifications, & Certificates */}
        <div className="space-y-6">
          {/* Registration Details Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h2 className="font-serif text-base font-bold text-royal-900 border-b border-slate-100 pb-3">
              Registration Record
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Participant Code:</span>
                <span className="font-mono font-bold text-royal-900">{reg.participants?.participant_code}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-medium text-royal-900">{fullName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-royal-900 truncate max-w-[170px]">{user?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Mobile:</span>
                <span className="font-medium text-royal-900">{reg.participants?.mobile || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Country:</span>
                <span className="font-medium text-royal-900">{reg.participants?.country || 'India'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold text-royal-900">{reg.research_categories?.name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Entry Fee:</span>
                <span className="font-semibold text-emerald-700">
                  {paid ? 'Paid (₹499)' : 'Pending (₹499)'}
                </span>
              </div>
            </div>
          </div>

          {/* In-Dashboard Notifications Feed */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-royal-700" />
                <h2 className="font-serif text-base font-bold text-royal-900">
                  Notifications &amp; Updates
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-royal-100 text-royal-800">
                {notifications.length} updates
              </span>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No notifications yet.</p>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <article
                    key={n.id}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs space-y-1 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-royal-900">{n.title}</span>
                      <time className="text-[10px] text-slate-400">{fmtDate(n.created_at)}</time>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{n.message}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Certificates Section */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Award className="w-4 h-4 text-royal-700" />
              <h2 className="font-serif text-base font-bold text-royal-900">
                Official Certificates
              </h2>
            </div>

            {certs.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 space-y-1">
                <p>Certificates will be issued upon competition conclusion.</p>
                <p className="text-[10px] text-slate-400">Participation &amp; Merit certificates included.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {certs.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-royal-50/70 border border-royal-100 text-xs"
                  >
                    <div>
                      <p className="font-bold text-royal-900">{c.award}</p>
                      <p className="text-[10px] font-mono text-royal-700">{c.certificate_code}</p>
                    </div>
                    <Link
                      to={`/verify/${c.certificate_code}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-royal-800 border border-royal-200 hover:bg-royal-50 shadow-2xs"
                    >
                      <Eye className="w-3 h-3" /> View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Competition Schedule Component with Live Accurate Countdown
 * ─────────────────────────────────────────────────────────────────────────────
 * Dates:
 * - Starts: 8 November 2026
 * - Ends: 22 November 2026
 * - Results announcement: December 2026
 */
function CompetitionScheduleCard({ settings }: { settings: ReturnType<typeof useSettings> }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Explicit competition dates
  const start = settings?.competition_starts_at
    ? Date.parse(settings.competition_starts_at)
    : Date.parse('2026-11-08T00:00:00+05:30')
  const end = settings?.competition_ends_at
    ? Date.parse(settings.competition_ends_at)
    : Date.parse('2026-11-22T23:59:59+05:30')
  const results = settings?.results_announcement_at
    ? Date.parse(settings.results_announcement_at)
    : Date.parse('2026-12-01T00:00:00+05:30')

  // Phase computation
  const isUpcoming = now < start
  const isInProgress = now >= start && now <= end
  const isClosed = now > end

  const target = isUpcoming ? start : isInProgress ? end : results
  const remaining = Math.max(0, target - now)

  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor(remaining / 3600000) % 24
  const minutes = Math.floor(remaining / 60000) % 60
  const seconds = Math.floor(remaining / 1000) % 60

  const fmt = (n: number) => String(n).padStart(2, '0')

  return (
    <section className="rounded-2xl bg-gradient-to-br from-white via-royal-50/30 to-white p-6 sm:p-7 shadow-sm border border-slate-200/80">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg sm:text-xl font-bold text-royal-950 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-royal-700" />
              Competition Schedule
            </h2>
            {isUpcoming && (
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Upcoming Stage
              </span>
            )}
            {isInProgress && (
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                ● Live &amp; Accepting Submissions
              </span>
            )}
            {isClosed && (
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                Submissions Closed
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-white p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Competition Starts</span>
              <p className="font-semibold text-royal-900 mt-0.5">8 November 2026</p>
              <span className="text-[10px] text-slate-500">12:00 AM IST</span>
            </div>
            <div className="rounded-xl bg-white p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submission Closes</span>
              <p className="font-semibold text-royal-900 mt-0.5">22 November 2026</p>
              <span className="text-[10px] text-slate-500">11:59 PM IST</span>
            </div>
            <div className="rounded-xl bg-white p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Results Announcement</span>
              <p className="font-semibold text-royal-900 mt-0.5">December 2026</p>
              <span className="text-[10px] text-slate-500">Official Release</span>
            </div>
          </div>

          {isClosed && (
            <div className="rounded-xl bg-purple-50 p-3 border border-purple-200 text-xs text-purple-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                <strong>Notice:</strong> Submissions are now closed. The peer review jury is evaluating all papers. Results will be announced in December 2026.
              </span>
            </div>
          )}
        </div>

        {/* Live Digital Countdown Unit */}
        <div className="flex flex-col items-center justify-center rounded-2xl bg-royal-950 p-5 text-white shadow-md border border-royal-800 min-w-[260px]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gold-300 text-center mb-3">
            {isUpcoming
              ? 'Competition Begins In'
              : isInProgress
              ? 'Submission Deadline Closes In'
              : 'Results Announcement In'}
          </p>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-2 min-w-[50px] border border-white/10">
              <span className="font-mono text-xl sm:text-2xl font-bold text-white">{fmt(days)}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-300">Days</span>
            </div>
            <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-2 min-w-[50px] border border-white/10">
              <span className="font-mono text-xl sm:text-2xl font-bold text-white">{fmt(hours)}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-300">Hours</span>
            </div>
            <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-2 min-w-[50px] border border-white/10">
              <span className="font-mono text-xl sm:text-2xl font-bold text-white">{fmt(minutes)}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-300">Mins</span>
            </div>
            <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-2 min-w-[50px] border border-white/10">
              <span className="font-mono text-xl sm:text-2xl font-bold text-gold-300">{fmt(seconds)}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-300">Secs</span>
            </div>
          </div>

          <span className="text-[10px] text-white/50 mt-2 font-mono">Timezone: IST (UTC+05:30)</span>
        </div>
      </div>
    </section>
  )
}
