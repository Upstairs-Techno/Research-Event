import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PaperView from '../components/PaperView'
import ReportPanel from '../components/ReportPanel'
import { fmtDate, useSettings } from '../lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function JudgeEvaluate() {
  const { submissionId } = useParams()
  const { user } = useAuth()
  const settings = useSettings()
  const [sub, setSub] = useState<any>(null)
  const [reg, setReg] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [evalStatus, setEvalStatus] = useState<'draft' | 'submitted' | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!submissionId || !user) return
    ;(async () => {
      const { data: s } = await supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle()
      setSub(s)
      if (!s) return
      const [{ data: r }, { data: rep }, { data: act }, { data: ev }] = await Promise.all([
        supabase.from('registrations').select('abstract, research_categories(name)').eq('id', s.registration_id).maybeSingle(),
        supabase.from('originality_reports').select('*').eq('submission_id', s.id).order('created_at', { ascending: false }),
        supabase.from('submission_activity').select('*').eq('submission_id', s.id).order('created_at'),
        supabase.from('evaluations').select('*').eq('submission_id', s.id).eq('judge_id', user.id).maybeSingle(),
      ])
      setReg(r); setReports(rep ?? []); setActivity(act ?? [])
      if (ev) { setScores(ev.scores ?? {}); setFeedback(ev.feedback); setEvalStatus(ev.status); setRejectionReason(ev.rejection_reason ?? '') }
    })()
  }, [submissionId, user])

  if (!sub || !settings) return <p className="p-10 text-center text-slate-500">Loading…</p>

  const rubric = settings.rubric
  const total = Math.round(rubric.reduce((acc, r) => acc + ((scores[r.key] ?? 0) / 10) * r.weight, 0) * 100) / 100
  const readOnly = evalStatus === 'submitted'
  const pastes = activity.filter((a) => a.event_type === 'paste')
  const large = activity.filter((a) => a.event_type === 'large_insert')
  const activeMin = Math.round(activity.filter((a) => a.event_type === 'session').reduce((n, a) => n + (a.meta?.active_seconds ?? 0), 0) / 60)

  const save = async (status: 'draft' | 'submitted') => {
    if (status === 'submitted' && rubric.some((r) => scores[r.key] == null)) { setMsg('Score every criterion before submitting.'); return }
    if (status === 'submitted' && !confirm('Submit your evaluation? You cannot change it afterwards.')) return
    const { error } = await supabase.from('evaluations').upsert(
      { submission_id: sub.id, judge_id: user!.id, scores, total, feedback, status, rejection_reason: null, updated_at: new Date().toISOString() },
      { onConflict: 'submission_id,judge_id' })
    if (error) { setMsg(error.message); return }
    setEvalStatus(status); setMsg(status === 'submitted' ? 'Evaluation submitted.' : 'Draft saved.')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link to="/judge" className="text-sm text-royal-700 underline">← Assigned submissions</Link>
      <div>
        <h1 className="font-serif text-3xl font-bold text-royal-800">{sub.title}</h1>
        <p className="text-sm text-slate-500">{reg?.research_categories?.name} · {sub.word_count} words · submitted {fmtDate(sub.submitted_at)}
          {sub.flagged && <span className="badge ml-2 bg-red-100 text-red-700">Flagged — review reports carefully</span>}
        </p>
        <p className="mt-1 text-xs text-slate-400">Participant identity is withheld for blind review.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {reg?.abstract && <div className="card text-sm"><h2 className="mb-1 font-semibold text-royal-800">Registered abstract</h2><p className="whitespace-pre-wrap text-slate-600">{reg.abstract}</p></div>}
          <PaperView content={sub.content} />
        </div>

        <div className="space-y-4">
          <div className="card"><h2 className="mb-2 font-semibold text-royal-800">Originality reports</h2><ReportPanel reports={reports} /></div>

          <div className="card space-y-1 text-sm">
            <h2 className="font-semibold text-royal-800">Writing activity</h2>
            <p>Paste events: <b>{pastes.length}</b> ({pastes.reduce((n, a) => n + a.char_count, 0).toLocaleString()} chars)</p>
            <p>Large insertions: <b>{large.length}</b></p>
            <p>Active editing time: <b>~{activeMin} min</b></p>
            {pastes.slice(0, 5).map((p) => (
              <p key={p.id} className="truncate text-xs text-slate-500">{fmtDate(p.created_at)} · {p.char_count} chars · “{p.meta?.preview}”</p>
            ))}
            <p className="pt-1 text-xs text-slate-500">Pasting is context only — it can be legitimate (references, quotations, own notes) and is not evidence of plagiarism.</p>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-royal-800">Evaluation</h2>
            {rejectionReason && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Administrator requested revisions</p>
              <p className="mt-1 whitespace-pre-wrap">{rejectionReason}</p>
            </div>}
            {rubric.map((r) => (
              <div key={r.key}>
                <label className="label" htmlFor={r.key}>{r.label} <span className="text-slate-400">({r.weight}%)</span> — {scores[r.key] ?? 0}/10</label>
                <input id={r.key} type="range" min={0} max={10} step={0.5} disabled={readOnly} className="w-full accent-royal-800"
                  value={scores[r.key] ?? 0} onChange={(e) => setScores((p) => ({ ...p, [r.key]: Number(e.target.value) }))} />
              </div>
            ))}
            <p className="font-semibold">Total: {total} / 100</p>
            <div><label className="label" htmlFor="fb">Comments &amp; feedback</label>
              <textarea id="fb" rows={5} className="input" disabled={readOnly} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
            {msg && <p role="status" className="text-sm text-royal-800">{msg}</p>}
            {!readOnly ? (
              <div className="flex gap-2">
                <button className="btn-outline" onClick={() => save('draft')}>Save draft</button>
                <button className="btn-primary" onClick={() => save('submitted')}>Submit evaluation</button>
              </div>
            ) : <p className="text-sm font-medium text-green-700">Evaluation submitted.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
