import { Link } from 'react-router-dom'
import { fmtDate, rupees, useSettings } from '../lib/utils'

const awards = [
  { place: 'First Prize', amount: '₹15,000', rank: '01', tone: 'first' },
  { place: 'Second Prize', amount: '₹10,000', rank: '02', tone: 'second' },
  { place: 'Third Prize', amount: '₹5,000', rank: '03', tone: 'third' },
]

export default function Home() {
  const s = useSettings()
  return (
    <div className="home-page">
      <section className="hero-shell">
        <div className="hero-copy">
          <div className="brand-lockup"><img className="hero-logo" src="/favicon/android-chrome-192x192.png" alt="Upstairs Techno" /><span>GI <i>×</i> Knowlegram</span></div>
          <p className="eyebrow">A celebration of knowledge & discovery</p>
          <h1>Research<br /><em>Distinction</em><br />Awards</h1>
          <p className="hero-tagline">Recognizing Research.<br />Rewarding Excellence.</p>
          <p className="hero-description">An invitation to scholars and curious minds to share original work across scientific and Vedic traditions.</p>
          <div className="hero-actions">
            <Link to="/register" className="btn-gold">Register now <span aria-hidden="true">↗</span></Link>
            <a href="#awards" className="hero-secondary">Explore the awards <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-categories"><span>Scientific Research</span><b>✦</b><span>Vedic Research</span></div>
        </div>
        <div className="hero-art" aria-label="Research Distinction Awards emblem">
          <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
          <div className="art-center"><img src="/Research%20distinction%20event.jpeg" alt="Research Distinction Awards event artwork" /></div>
          <div className="art-caption">THE PURSUIT<br/>OF KNOWLEDGE</div>
        </div>
        <div className="hero-index">01 <span>—</span> RESEARCH · RECOGNITION · IMPACT</div>
      </section>

      <section className="intro-section section-wrap">
        <div className="section-kicker">A DISTINCTION THAT MATTERS <span>✦</span></div>
        <div className="intro-grid"><h2>Where enduring wisdom<br/>meets <em>new discovery.</em></h2>
          <div><p>The Research Distinction Awards celebrate thoughtful, original research and the people who move knowledge forward. We bring together modern scientific inquiry and the depth of India’s Vedic knowledge systems in one academic platform.</p><p>Organized by <b>GI &amp; Knowlegram</b> with our collaborating organization, the awards give researchers a stage to share their work and be recognized for its contribution.</p></div>
        </div>
      </section>

      <section className="partners-section">
        <div className="section-wrap">
          <div className="section-kicker">IN COLLABORATION WITH <span>✦</span></div>
          <h2 className="partners-heading">Our event partners</h2>
          <div className="partners-grid">
            <div className="partner-card"><img src="/GI.jpeg" alt="GI partner logo" /></div>
            <div className="partner-card"><img src="/know.jpeg" alt="Knowlegram partner logo" /></div>
          </div>
        </div>
      </section>

      <section className="category-section">
        <div className="section-wrap"><div className="section-kicker">TWO PATHS OF INQUIRY <span>02</span></div>
          <div className="category-grid">
            <article className="category-card science"><div className="category-symbol">⌬</div><p className="eyebrow">01 / THE MODERN FRONTIER</p><h2>Scientific<br/><em>Research</em></h2><p>Ideas that advance understanding and shape what comes next. Explore science, technology, innovation and interdisciplinary research.</p><span className="card-rule"/></article>
            <article className="category-card vedic"><div className="category-symbol">ॐ</div><p className="eyebrow">02 / ANCIENT KNOWLEDGE</p><h2>Vedic<br/><em>Research</em></h2><p>Inquiry into Indian knowledge systems, philosophy and consciousness—and the connections between ancient wisdom and modern insight.</p><span className="card-rule"/></article>
          </div>
        </div>
      </section>

      <section className="awards-section section-wrap" id="awards">
        <div className="awards-heading"><div><div className="section-kicker">MERIT RECOGNIZED <span>03</span></div><h2>Excellence,<br/><em>rewarded.</em></h2></div><p>Outstanding work deserves a distinction. Three awards recognize the research that rises to the occasion.</p></div>
        <div className="podium-grid">{awards.map((a) => <article className={`prize-card ${a.tone}`} key={a.place}><span className="prize-rank">{a.rank}</span><div className="laurel">✦</div><p>{a.place}</p><h3>{a.amount}</h3><span className="prize-label">RESEARCH DISTINCTION</span></article>)}</div>
        <p className="award-note">All participants who submit a paper receive a digital certificate with a verifiable ID.</p>
      </section>

      <section className="details-band"><div className="section-wrap details-layout"><div><div className="section-kicker">PLAN YOUR PARTICIPATION <span>04</span></div><h2>The details,<br/><em>beautifully clear.</em></h2><p>Everything you need to take the next step in your research journey.</p><Link to="/register" className="btn-gold">Begin registration <span>↗</span></Link></div>
        <div className="detail-list">
          <div><span>FORMAT</span><b>Virtual competition</b></div>
          <div><span>REGISTRATION</span><b>{s ? rupees(s.fee_paise) : '₹499'} <small>one-time fee</small></b></div>
          <div><span>ELIGIBILITY</span><b>Students, researchers, academics &amp; independent authors</b></div>
          <div><span>SUBMISSION</span><b>Original, referenced research · written in the portal</b></div>
          <div><span>DEADLINE</span><b>{s?.submission_deadline ? fmtDate(s.submission_deadline) : 'More updates soon'}</b></div>
          <div><span>EVALUATION</span><b>Expert judging · transparent evaluation</b></div>
          <div><span>AWARD CEREMONY</span><b>To be announced</b></div>
        </div></div>
      </section>

      <section className="closing-cta"><span>YOUR RESEARCH HAS A PLACE HERE</span><h2>Bring your ideas<br/><em>into distinction.</em></h2><Link to="/register" className="btn-gold">Register now <span>↗</span></Link></section>
    </div>
  )
}
