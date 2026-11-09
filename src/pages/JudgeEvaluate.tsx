import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PaperView from '../components/PaperView'
import ReportPanel from '../components/ReportPanel'
import { fmtDate } from '../lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
const rejectReasons = ['Plagiarism or Similarity Concerns','Incomplete Research Paper','Incorrect Research Category','Insufficient Research Quality','Lack of Originality','Weak Research Methodology','Missing Required Information','Does Not Meet Competition Guidelines','Other']
function findPdf(value: any): string | null {
  if (!value) return null
  if (Array.isArray(value)) { for (const item of value) { const found = findPdf(item); if (found) return found } }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && ['href','src','url'].includes(key.toLowerCase()) && (/\.pdf(?:[?#]|$)/i.test(child) || child.toLowerCase().includes('application/pdf'))) return child
      const found = findPdf(child); if (found) return found
    }
  }
  return null
}

export default function JudgeEvaluate() {
  const { submissionId } = useParams()
  const { user } = useAuth()
  const [settings, setSettings] = useState<any>(null)
  const [sub, setSub] = useState<any>(null)
  const [reg, setReg] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [criterionRemarks, setCriterionRemarks] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [decision, setDecision] = useState<'accepted'|'rejected'>('accepted')
  const [rejectionReason, setRejectionReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [evalStatus, setEvalStatus] = useState<'draft'|'submitted'|null>(null)
  const [savedDecision, setSavedDecision] = useState('pending')
  const [evaluatedAt, setEvaluatedAt] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  useEffect(() => {
    if (!submissionId || !user) return
    let active = true
    ;(async () => {
      const [{ data: s, error: subError }, { data: cfg }] = await Promise.all([
        supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle(),
        supabase.from('competition_settings').select('rubric').eq('id',1).maybeSingle(),
      ])
      if (!active) return
      if (subError || !s) { setMsg(subError?.message || 'This paper is unavailable or not assigned to your account.'); return }
      setSub(s); setSettings(cfg)
      const [{ data: r }, { data: rep }, { data: act }, { data: ev }] = await Promise.all([
        supabase.from('registrations').select('abstract, research_categories(name)').eq('id', s.registration_id).maybeSingle(),
        supabase.from('originality_reports').select('*').eq('submission_id', s.id).order('created_at',{ascending:false}),
        supabase.from('submission_activity').select('*').eq('submission_id', s.id).order('created_at'),
        supabase.from('evaluations').select('*').eq('submission_id',s.id).eq('judge_id',user.id).maybeSingle(),
      ])
      if (!active) return
      setReg(r); setReports(rep ?? []); setActivity(act ?? [])
      if (ev) { setScores(ev.scores ?? {}); setFeedback(ev.feedback ?? ''); setEvalStatus(ev.status); setRejectionReason(ev.rejection_reason ?? ''); setSavedDecision(ev.decision ?? 'pending'); setSuggestions(ev.improvement_suggestions ?? ''); setCriterionRemarks(ev.criterion_remarks ?? {}); setEvaluatedAt(ev.evaluated_at) }
    })()
    return () => { active = false }
  }, [submissionId,user])
  const rubric = settings?.rubric ?? []
  const total = useMemo(() => Math.round(rubric.reduce((acc: number,r: any) => acc + ((scores[r.key] ?? 0)/10)*Number(r.weight),0)*100)/100,[rubric,scores])
  const readOnly = evalStatus === 'submitted'
  const rejectionSelection = rejectionReason === 'Other' ? customReason.trim() : rejectionReason.trim()
  const pdfUrl = findPdf(sub?.content)
  const pastes = activity.filter((a) => a.event_type === 'paste')
  const large = activity.filter((a) => a.event_type === 'large_insert')
  const activeMin = Math.round(activity.filter((a) => a.event_type === 'session').reduce((n,a) => n+(a.meta?.active_seconds ?? 0),0)/60)

  const save = async (draft: boolean) => {
    if (!user || !sub) return
    if (!draft && rubric.some((r: any) => scores[r.key] == null)) { setMsg('Score every active criterion before submitting.'); return }
    if (!draft && !feedback.trim()) { setMsg('Detailed evaluation feedback is required.'); return }
    if (!draft && decision === 'rejected' && !rejectionSelection) { setMsg('Select a rejection reason and provide an explanation when Other is selected.'); return }
    if (!draft && !window.confirm(`Confirm ${decision === 'accepted' ? 'accepting' : 'rejecting'} this submission? Your evaluation will be finalized.`)) return
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('save_judge_evaluation', { p_submission: sub.id, p_decision: decision, p_scores: scores, p_total: total, p_feedback: feedback.trim(), p_rejection_reason: decision === 'rejected' ? rejectionSelection : null, p_improvement_suggestions: suggestions.trim(), p_criterion_remarks: criterionRemarks, p_draft: draft })
    setBusy(false)
    if (error) { setMsg(error.message); return }
    setEvalStatus(draft ? 'draft' : 'submitted'); setSavedDecision(draft ? 'pending' : decision); setEvaluatedAt(draft ? null : new Date().toISOString()); setMsg(draft ? 'Draft saved.' : decision === 'accepted' ? 'Research paper successfully accepted.' : 'Research paper has been rejected and the evaluation has been recorded.')
  }

  if (!sub) return <div role="status" className="mx-auto max-w-3xl p-10 text-center text-slate-600">{msg || 'Loading assigned research paper…'}</div>
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <Link to="/judge" className="text-sm text-royal-700 underline">← Judge workspace</Link>
    <header><h1 className="break-words font-serif text-2xl font-bold text-royal-800 sm:text-3xl">{sub.title}</h1><p className="mt-1 text-sm text-slate-500">{reg?.research_categories?.name} · {sub.word_count} words · submitted {fmtDate(sub.submitted_at)}{sub.flagged && <span className="badge ml-2 bg-red-100 text-red-700">Flagged — review reports carefully</span>}</p><p className="mt-1 text-xs text-slate-400">Participant identity is withheld for blind review.</p></header>
    {pdfUrl && <section className="card space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-royal-900">Uploaded PDF</h2><p className="text-xs text-slate-500">Use the document controls to navigate, zoom, or download.</p></div><a className="btn-outline !py-2 !px-3 !text-xs" href={pdfUrl} target="_blank" rel="noreferrer">Open / download</a></div>{pdfError ? <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">The PDF preview could not be loaded. Open the document in a new tab to view it.</p> : <iframe title="Research paper PDF" src={pdfUrl} className="h-[65vh] min-h-[420px] w-full rounded-xl border border-slate-200" onError={() => setPdfError(true)}/>}</section>}
    <div className="grid gap-6 lg:grid-cols-3"><div className="space-y-4 lg:col-span-2">{reg?.abstract && <div className="card text-sm"><h2 className="mb-1 font-semibold text-royal-800">Registered abstract</h2><p className="whitespace-pre-wrap text-slate-600">{reg.abstract}</p></div>}<PaperView content={sub.content}/></div>
      <aside className="space-y-4"><div className="card"><h2 className="mb-2 font-semibold text-royal-800">Originality reports</h2><ReportPanel reports={reports}/></div><div className="card space-y-1 text-sm"><h2 className="font-semibold text-royal-800">Writing activity</h2><p>Paste events: <b>{pastes.length}</b> ({pastes.reduce((n,a)=>n+a.char_count,0).toLocaleString()} chars)</p><p>Large insertions: <b>{large.length}</b></p><p>Active editing time: <b>~{activeMin} min</b></p><p className="pt-1 text-xs text-slate-500">Pasting is context only and is not evidence of plagiarism.</p></div>
      <div className="card space-y-4"><h2 className="font-serif text-lg font-bold text-royal-900">Evaluation</h2>{readOnly && <div className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Finalized: {savedDecision} · {fmtDate(evaluatedAt)}</div>}
        {rubric.map((r: any)=><div key={r.key} className="space-y-1"><label className="label" htmlFor={r.key}>{r.label} <span className="text-slate-400">({r.weight}%)</span> — {scores[r.key] ?? 0}/10</label><input id={r.key} type="range" min={0} max={10} step={0.5} disabled={readOnly} className="w-full accent-royal-800" value={scores[r.key] ?? 0} onChange={(e)=>setScores((p)=>({...p,[r.key]:Number(e.target.value)}))}/><input className="input" disabled={readOnly} aria-label={`${r.label} remarks`} placeholder="Criterion remarks (optional)" value={criterionRemarks[r.key] ?? ''} onChange={(e)=>setCriterionRemarks((p)=>({...p,[r.key]:e.target.value}))}/></div>)}
        <p className="font-semibold">Total: {total} / 100</p><label className="block"><span className="label">Decision</span><select className="input" disabled={readOnly} value={decision} onChange={(e)=>setDecision(e.target.value as any)}><option value="accepted">Accept submission</option><option value="rejected">Reject submission</option></select></label>
        {decision==='rejected' && <div className="space-y-2"><label className="block"><span className="label">Mandatory rejection reason</span><select className="input" disabled={readOnly} value={rejectionReason} onChange={(e)=>setRejectionReason(e.target.value)}><option value="">Select reason</option>{rejectReasons.map((r)=><option key={r}>{r}</option>)}</select></label>{rejectionReason==='Other' && <input className="input" disabled={readOnly} placeholder="Explain the reason" value={customReason} onChange={(e)=>setCustomReason(e.target.value)}/>}</div>}
        <label className="block"><span className="label">Evaluation remarks and detailed feedback (required)</span><textarea rows={5} className="input" disabled={readOnly} value={feedback} onChange={(e)=>setFeedback(e.target.value)}/></label><label className="block"><span className="label">Improvement suggestions (optional)</span><textarea rows={3} className="input" disabled={readOnly} value={suggestions} onChange={(e)=>setSuggestions(e.target.value)}/></label>
        {msg && <p role="status" className="text-sm text-royal-800">{msg}</p>}{!readOnly && <div className="grid gap-2 sm:grid-cols-2"><button className="btn-outline" disabled={busy} onClick={()=>void save(true)}>Save draft</button><button className="btn-primary" disabled={busy} onClick={()=>void save(false)}>{busy?'Saving…':decision==='accepted'?'Accept submission':'Reject submission'}</button></div>}</div></aside></div>
  </div>
}
