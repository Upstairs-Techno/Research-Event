import { Link } from 'react-router-dom'
import { fmtDate, rupees, useSettings } from '../lib/utils'

const FAQ = [
  ['Who can participate?', 'Students, researchers, academics and independent research authors. Entries are individual.'],
  ['What is the registration fee?', 'A one-time fee, payable online by UPI, card or net banking through Razorpay. See the refund policy before paying.'],
  ['Can I use AI tools or copy text?', 'Work must be your own original research. Submissions are checked for similarity and AI-generated content; flagged work is reviewed by humans — nothing is rejected automatically.'],
  ['Can I edit after submitting?', 'No. A submitted paper is locked. Contact the organizers if a correction is essential.'],
]

export default function Home() {
  const s = useSettings()
  return (
    <div>
      <section className="bg-gradient-to-br from-royal-900 via-royal-800 to-royal-700 px-4 py-20 text-center text-white">
        <p className="text-sm uppercase tracking-[0.3em] text-gold-300">A virtual research competition</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-serif text-4xl font-bold sm:text-6xl">Research Distinction Awards</h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/80">
          Celebrating original research in Scientific and Vedic studies. Write, submit and be evaluated by
          expert judges — entirely online.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn-gold">Register now{s ? ` · ${rupees(s.fee_paise)}` : ''}</Link>
          <Link to="/login" className="btn-outline !border-white/60 !text-white hover:!bg-white/10">Log in</Link>
        </div>
        {s?.submission_deadline && (
          <p className="mt-6 text-sm text-gold-300">Submission deadline: {fmtDate(s.submission_deadline)}</p>
        )}
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14">
        <section>
          <h2 className="font-serif text-3xl font-bold text-royal-800">About the competition</h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            The Research Distinction Awards is organized by GI &amp; Knowlegram in partnership with a
            collaborating organization to promote original research, transparent evaluation and academic excellence.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <div className="card border-t-4 border-t-gold-500">
            <h3 className="font-serif text-xl font-bold text-royal-800">Scientific Research</h3>
            <p className="mt-2 text-sm text-slate-600">Original investigations across the sciences, engineering, medicine, social sciences and technology.</p>
          </div>
          <div className="card border-t-4 border-t-gold-500">
            <h3 className="font-serif text-xl font-bold text-royal-800">Vedic Research</h3>
            <p className="mt-2 text-sm text-slate-600">Scholarly work on Vedic knowledge systems, texts, philosophy, sciences and their contemporary relevance.</p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-3xl font-bold text-royal-800">Awards</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[['First Prize', '₹15,000'], ['Second Prize', '₹10,000'], ['Third Prize', '₹5,000']].map(([t, a]) => (
              <div key={t} className="card text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-gold-600">{t}</p>
                <p className="mt-2 font-serif text-3xl font-bold text-royal-800">{a}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">All participants whose papers are submitted receive a digital certificate with a verifiable ID.</p>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl font-bold text-royal-800">Guidelines &amp; eligibility</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
              <li>Individual participation; one paper per participant.</li>
              <li>Work must be original and properly referenced.</li>
              <li>Write directly in the portal; drafts autosave and keep version history.</li>
              <li>Writing activity (paste events, time spent) is recorded to help judges — it is never treated as proof of plagiarism.</li>
              <li>Similarity and AI-content reports are advisory and reviewed by humans.</li>
              <li>Submitted papers are locked.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-3xl font-bold text-royal-800">Fee &amp; policy</h2>
            <p className="mt-3 text-slate-600">Registration fee: <b>{s ? rupees(s.fee_paise) : '₹499'}</b> per participant.</p>
            <p className="mt-2 text-sm text-slate-500">{s?.refund_policy}</p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-3xl font-bold text-royal-800">FAQs</h2>
          <div className="mt-4 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card">
                <summary className="cursor-pointer font-semibold text-royal-800">{q}</summary>
                <p className="mt-2 text-sm text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="card bg-royal-50">
          <h2 className="font-serif text-2xl font-bold text-royal-800">Contact</h2>
          <p className="mt-2 text-sm text-slate-600">Add your organizing team's email and phone here (src/pages/Home.tsx).</p>
        </section>
      </div>
    </div>
  )
}
