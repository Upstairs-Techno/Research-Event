// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Report = { kind: string; score: number | null; status: string; details: any; created_at: string }

const when = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

/** Shows the latest plagiarism + AI reports. Always labelled advisory. */
export default function ReportPanel({ reports }: { reports: Report[] }) {
  const latest = (k: string) => reports.find((r) => r.kind === k)
  const plag = latest('plagiarism')
  const ai = latest('ai')

  if (!plag && !ai) return <p className="text-sm text-slate-500">No originality analysis has been run yet.</p>

  return (
    <div className="space-y-4 text-sm">
      <p className="rounded bg-gold-100 p-2 text-xs text-royal-900">
        These results are <b>advisory signals</b>. A high similarity or AI-content score is not proof of
        plagiarism or AI use and never causes automatic disqualification — it triggers manual review.
      </p>
      {plag && (
        <div>
          <h4 className="font-semibold text-royal-800">Similarity (plagiarism) report</h4>
          <p>
            Overall similarity: <b>{plag.score ?? '—'}%</b> · {plag.status} · {when(plag.created_at)}
            {plag.details?.mock && <span className="badge ml-2 bg-slate-200 text-slate-700">MOCK DATA</span>}
          </p>
          {plag.details?.by_section?.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {plag.details.by_section.map((s: any, i: number) => (
                <li key={i}>{s.section}: {s.similarity}%</li>
              ))}
            </ul>
          )}
          {plag.details?.matches?.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="font-medium">Matched passages</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {plag.details.matches.map((m: any, i: number) => (
                <blockquote key={i} className="border-l-2 border-gold-500 pl-2 text-slate-600">
                  {m.text}<br /><span className="text-xs">Source: {m.source ?? 'unknown'}</span>
                </blockquote>
              ))}
            </div>
          )}
        </div>
      )}
      {ai && (
        <div>
          <h4 className="font-semibold text-royal-800">AI-content indicator</h4>
          <p>
            Indicator: <b>{ai.score ?? '—'}%</b>
            {ai.details?.confidence != null && <> · confidence {String(ai.details.confidence)}</>}
            {' '}· {ai.status} · {when(ai.created_at)}
            {ai.details?.mock && <span className="badge ml-2 bg-slate-200 text-slate-700">MOCK DATA</span>}
          </p>
          {ai.details?.passages?.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-slate-600">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {ai.details.passages.map((p: any, i: number) => <li key={i}>{p.text}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
