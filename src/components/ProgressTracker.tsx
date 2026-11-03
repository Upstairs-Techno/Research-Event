import { Check, CircleDot, FileEdit, Award, CreditCard, Send, CheckCircle2 } from 'lucide-react'

const STEPS = [
  { name: 'Registration', icon: CircleDot, desc: 'Profile created' },
  { name: 'Payment', icon: CreditCard, desc: 'Entry confirmed' },
  { name: 'Research Writing', icon: FileEdit, desc: 'Drafting paper' },
  { name: 'Submission', icon: Send, desc: 'Locked for review' },
  { name: 'Evaluation', icon: CheckCircle2, desc: 'Peer & editorial review' },
  { name: 'Results & Awards', icon: Award, desc: 'Final winners' },
]

/** `current` = index of the step the participant is on (steps before it are complete, 0-indexed). */
export default function ProgressTracker({ current }: { current: number }) {
  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-royal-600">Competition Progress</span>
          <h3 className="font-serif text-lg font-bold text-royal-900">
            Step {Math.min(current + 1, STEPS.length)} of {STEPS.length}: {STEPS[Math.min(current, STEPS.length - 1)].name}
          </h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-royal-50 text-royal-800 border border-royal-200">
          {Math.round((Math.min(current, STEPS.length) / STEPS.length) * 100)}% Complete
        </span>
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Competition Progress Stepper">
        {STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          const upcoming = i > current

          return (
            <li
              key={s.name}
              className={`relative flex flex-col p-3 rounded-xl border transition-all duration-200 ${
                done
                  ? 'bg-royal-50/60 border-royal-200 text-royal-900'
                  : active
                  ? 'bg-white border-gold-500 shadow-md ring-2 ring-gold-500/20 text-royal-900'
                  : 'bg-slate-50/50 border-slate-200/80 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    done
                      ? 'bg-royal-800 text-gold-300'
                      : active
                      ? 'bg-gold-500 text-royal-900 shadow-sm'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? <Check className="w-4 h-4 stroke-[2.5]" /> : i + 1}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                  done ? 'text-royal-700' : active ? 'text-gold-600' : 'text-slate-400'
                }`}>
                  {done ? 'Done' : active ? 'Active' : 'Next'}
                </span>
              </div>
              <p className={`text-xs font-bold leading-tight ${active ? 'text-royal-900' : done ? 'text-royal-800' : 'text-slate-500'}`}>
                {s.name}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {s.desc}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
