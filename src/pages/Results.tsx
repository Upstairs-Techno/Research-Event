import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, useSettings } from '../lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Results() {
  const [rows, setRows] = useState<any[] | null>(null)
  const settings = useSettings()
  useEffect(() => {
    supabase.from('results').select('*').order('rank').then(({ data }) => setRows(data ?? []))
  }, [])
  const label = ['', 'First Prize', 'Second Prize', 'Third Prize']

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">
      <h1 className="font-serif text-3xl font-bold text-royal-800">Results</h1>
      {!rows ? <p className="text-slate-500">Loading…</p> : rows.length === 0 ? (
        <div className="card space-y-2"><p className="font-medium text-royal-800">Results have not been published yet.</p><p className="text-sm text-slate-600">The administrator will publish the results in December 2026{settings?.results_announcement_at ? ` (scheduled from ${fmtDate(settings.results_announcement_at)}).` : '.'}</p></div>
      ) : rows.map((r) => (
        <div key={r.id} className="card border-l-4 border-l-gold-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">{label[r.rank]} · ₹{r.prize_inr.toLocaleString('en-IN')}</p>
          <h2 className="font-serif text-xl font-bold text-royal-800">{r.winner_name}</h2>
          <p className="text-sm text-slate-600">{r.research_title}</p>
          <p className="text-xs text-slate-400">{r.category} · Score {r.final_score}</p>
        </div>
      ))}
    </div>
  )
}
