const STEPS = ['Registration', 'Payment', 'Research Writing', 'Submission', 'Evaluation', 'Results']

/** `current` = index of the step the participant is on (steps before it are complete). */
export default function ProgressTracker({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-gold-500 text-royal-900' : active ? 'bg-royal-800 text-white' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold text-royal-800' : 'text-slate-600'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
          </li>
        )
      })}
    </ol>
  )
}
