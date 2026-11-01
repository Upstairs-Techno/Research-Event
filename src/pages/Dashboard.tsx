import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProgressTracker from '../components/ProgressTracker'
import { fmtDate, useSettings } from '../lib/utils'

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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: r } = await supabase.from('registrations')
        .select('*, participants(participant_code), research_categories(name)').eq('user_id', user.id).maybeSingle()
      if (!r) { nav('/complete-registration', { replace: true }); return }
      setReg(r)
      const { data: s } = await supabase.from('submissions').select('*').eq('user_id', user.id).maybeSingle()
      setSub(s)
      if (s) {
        const [{ data: rep }, { data: ev }, { data: res }] = await Promise.all([
          supabase.from('originality_reports').select('kind, status, score').eq('submission_id', s.id).order('created_at', { ascending: false }),
          supabase.from('evaluations').select('total, feedback').eq('submission_id', s.id),
          supabase.from('results').select('*').eq('submission_id', s.id).maybeSingle(),
        ])
        setReports(rep ?? []); setEvals(ev ?? []); setResult(res)
      }
      const { data: c } = await supabase.from('certificates').select('*').eq('user_id', user.id)
      setCerts(c ?? [])
      setReady(true)
    })()
  }, [user, nav])

  if (!ready || !reg) return <p className="p-10 text-center text-slate-500">Loading…</p>

  const paid = reg.status === 'paid'
  const submitted = !!sub?.locked
  const published = !!settings?.results_published
  const step = !paid ? 1 : !submitted ? 2 : sub.status !== 'evaluated' ? 4 : published ? 5 : 4
  const evalStatus = evals.length ? 'Feedback available' : sub?.status === 'evaluated' ? 'Evaluated' : submitted ? 'Awaiting evaluation' : '—'

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="font-serif text-3xl font-bold text-royal-800">Welcome, {fullName}</h1>
        <p className="text-sm text-slate-500">Participant ID: <b>{reg.participants?.participant_code}</b></p>
      </div>
      <div className="card"><ProgressTracker current={submitted && published ? 6 : step === 4 && !submitted ? 3 : step} /></div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold text-royal-800">Your entry</h2>
          <p><span className="text-slate-500">Title:</span> {reg.research_title}</p>
          <p><span className="text-slate-500">Category:</span> {reg.research_categories?.name}</p>
          <p><span className="text-slate-500">Registration:</span> Complete</p>
          <p><span className="text-slate-500">Payment:</span>{' '}
            {paid ? <span className="badge bg-green-100 text-green-800">Paid</span> : <span className="badge bg-amber-100 text-amber-800">Pending</span>}
          </p>
          <p><span className="text-slate-500">Deadline:</span> {fmtDate(settings?.submission_deadline)}</p>
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold text-royal-800">Research paper</h2>
          <p><span className="text-slate-500">Status:</span> {!sub ? 'Not started' : submitted ? 'Submitted (locked)' : 'Draft'}</p>
          {sub && <p><span className="text-slate-500">Words:</span> {sub.word_count} · last saved {fmtDate(sub.updated_at)}</p>}
          <p><span className="text-slate-500">Originality reports:</span> {reports.length ? `${reports.length} available` : 'Not run yet'}</p>
          <p><span className="text-slate-500">Evaluation:</span> {evalStatus}</p>
          {!paid ? (
            <Link to="/payment" className="btn-gold">Pay registration fee</Link>
          ) : (
            <Link to="/editor" className="btn-primary">{submitted ? 'View paper' : sub ? 'Continue writing' : 'Start writing'}</Link>
          )}
        </div>
      </div>

      {published && result && (
        <div className="card border-gold-500 bg-gold-100/40">
          <h2 className="font-serif text-xl font-bold text-royal-800">🏆 Congratulations — rank {result.rank}</h2>
          <p className="text-sm">Prize: ₹{result.prize_inr.toLocaleString('en-IN')} · Final score {result.final_score}</p>
        </div>
      )}

      {published && evals.length > 0 && (
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold text-royal-800">Judge feedback</h2>
          {evals.map((e, i) => (
            <div key={i} className="rounded bg-slate-50 p-3">
              <p className="font-medium">Score: {e.total}/100</p>
              <p className="whitespace-pre-wrap text-slate-600">{e.feedback || 'No written feedback.'}</p>
            </div>
          ))}
        </div>
      )}

      {certs.length > 0 && (
        <div className="card text-sm">
          <h2 className="mb-2 font-semibold text-royal-800">Certificates</h2>
          <ul className="space-y-1">
            {certs.map((c) => (
              <li key={c.id}>
                {c.award} — <Link className="text-royal-700 underline" to={`/verify/${c.certificate_code}`}>{c.certificate_code}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
