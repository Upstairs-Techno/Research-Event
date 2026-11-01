import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, role, fullName, signOut } = useAuth()
  const nav = useNavigate()
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded px-2 py-1 text-sm ${isActive ? 'text-gold-300' : 'text-white/90 hover:text-gold-300'}`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print bg-royal-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="font-serif text-lg font-bold text-gold-300">
            Research Distinction Awards
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={link}>Home</NavLink>
            <NavLink to="/results" className={link}>Results</NavLink>
            <NavLink to="/verify" className={link}>Verify certificate</NavLink>
            {user && role === 'participant' && <NavLink to="/dashboard" className={link}>Dashboard</NavLink>}
            {user && role === 'judge' && <NavLink to="/judge" className={link}>Judge</NavLink>}
            {user && role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
            {user ? (
              <>
                <span className="hidden px-2 text-xs text-white/60 sm:inline">{fullName || user.email}</span>
                <button className="btn-gold !py-1" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-outline !border-white/60 !py-1 !text-white hover:!bg-white/10">Log in</Link>
                <Link to="/register" className="btn-gold !py-1">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="no-print bg-royal-900 py-6 text-center text-xs text-white/70">
        Organized by GI &amp; Knowlegram in partnership with our collaborating organization ·
        Research Distinction Awards
      </footer>
    </div>
  )
}
