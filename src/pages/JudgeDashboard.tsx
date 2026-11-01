import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function JudgeDashboard() {
  const { user } = useAuth()
  const [rows, setRows] = useState<any[] | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: assigns } = await supabase.from('judge_assignments')
        .select('submission_id, submissions(id, title, flagged, word_count, registrations(research_categories(name)))')
        .eq('judge_id', user.id)
      const { data: evs } = await supabase.from('evaluations').select('submission_id, status, total').eq('judge_id', user.id)
      const evMap = new Map((evs ?? []).map((e) => [e.submission_id, e]))
      setRows((assigns ?? []).map((a: any) => ({ ...a.submissions, evaluation: evMap.get(a.submission_id) })))
    })()
  }, [user])

  if (!rows) return <p className="p-10 text-center text-slate-500">Loading…</p>
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">
      <h1 className="font-serif text-3xl font-bold text-royal-800">Assigned submissions</h1>
      {rows.length === 0 && <p className="text-slate-500">Nothing has been assigned to you yet.</p>}
      <div className="grid gap-3">
        {rows.map((s) => (
          <Link key={s.id} to={`/judge/${s.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-royal-600">
            <div>
              <p className="font-semibold text-royal-800">{s.title}</p>
              <p className="text-xs text-slate-500">{s.registrations?.research_categories?.name} · {s.word_count} words</p>
            </div>
            <div className="flex gap-2">
              {s.flagged && <span className="badge bg-red-100 text-red-700">Flagged for review</span>}
              <span className={`badge ${s.evaluation?.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {s.evaluation?.status === 'submitted' ? `Scored ${s.evaluation.total}` : s.evaluation ? 'Draft' : 'To evaluate'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
