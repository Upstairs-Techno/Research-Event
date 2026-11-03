import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Award, 
  CheckCircle2, 
  LayoutDashboard, 
  FileEdit, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X,
  UserCheck
} from 'lucide-react'

export default function Layout() {
  const { user, role, fullName, signOut } = useAuth()
  const nav = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
      isActive
        ? 'bg-royal-800 text-gold-300 shadow-sm border border-gold-500/30'
        : 'text-slate-200 hover:text-white hover:bg-white/10'
    }`

  const roleBadge = () => {
    if (!role) return null
    const map: Record<string, { label: string; cls: string }> = {
      admin: { label: 'Admin', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
      judge: { label: 'Judge', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
      participant: { label: 'Participant', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    }
    const cur = map[role] || { label: role, cls: 'bg-slate-500/20 text-slate-300 border-slate-500/40' }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cur.cls}`}>
        <UserCheck className="w-3 h-3" />
        {cur.label}
      </span>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50">
      <header className="no-print sticky top-0 z-50 bg-[#061331] border-b border-[#00c8ef]/40 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-royal-700 to-royal-950 p-1 border border-gold-500/40 shadow-md group-hover:scale-105 transition-transform">
              <img
                className="h-full w-full object-cover rounded-lg"
                src="/favicon/android-chrome-192x192.png"
                alt="Research Distinction Awards"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-gold-300 transition-colors">
                Research Distinction Awards
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00c8ef]">
                Academic Competition &amp; Portal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/results" className={navLinkClass}>
              <Award className="w-3.5 h-3.5" />
              Results
            </NavLink>
            <NavLink to="/verify" className={navLinkClass}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verify Certificate
            </NavLink>

            {user && role === 'participant' && (
              <>
                <NavLink to="/dashboard" className={navLinkClass}>
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </NavLink>
                <NavLink to="/editor" className={navLinkClass}>
                  <FileEdit className="w-3.5 h-3.5" />
                  Paper Editor
                </NavLink>
              </>
            )}

            {user && role === 'judge' && (
              <NavLink to="/judge" className={navLinkClass}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Judge Panel
              </NavLink>
            )}

            {user && role === 'admin' && (
              <NavLink to="/admin" className={navLinkClass}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin Portal
              </NavLink>
            )}

            {/* Auth Actions */}
            <div className="flex items-center gap-2.5 ml-3 pl-3 border-l border-white/15">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                      {fullName || user.email?.split('@')[0]}
                    </span>
                    {roleBadge()}
                  </div>
                  <button
                    onClick={async () => {
                      await signOut()
                      nav('/')
                    }}
                    title="Sign Out"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-red-500/20 text-slate-200 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#00c8ef] text-royal-950 hover:bg-[#83eaff] shadow-sm hover:shadow transition-all"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            {user && (
              <span className="text-xs text-white/80 font-medium truncate max-w-[120px]">
                {fullName || user.email?.split('@')[0]}
              </span>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-white hover:bg-white/10 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#061331] px-4 pt-3 pb-5 space-y-2 animate-in slide-in-from-top-2 duration-150">
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={navLinkClass}
            >
              Home
            </NavLink>
            <NavLink
              to="/results"
              onClick={() => setMobileMenuOpen(false)}
              className={navLinkClass}
            >
              <Award className="w-3.5 h-3.5" />
              Results
            </NavLink>
            <NavLink
              to="/verify"
              onClick={() => setMobileMenuOpen(false)}
              className={navLinkClass}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verify Certificate
            </NavLink>

            {user && role === 'participant' && (
              <>
                <NavLink
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={navLinkClass}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </NavLink>
                <NavLink
                  to="/editor"
                  onClick={() => setMobileMenuOpen(false)}
                  className={navLinkClass}
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  Paper Editor
                </NavLink>
              </>
            )}

            {user && role === 'judge' && (
              <NavLink
                to="/judge"
                onClick={() => setMobileMenuOpen(false)}
                className={navLinkClass}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Judge Panel
              </NavLink>
            )}

            {user && role === 'admin' && (
              <NavLink
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={navLinkClass}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin Portal
              </NavLink>
            )}

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              {user ? (
                <>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-white/70">{user.email}</span>
                    {roleBadge()}
                  </div>
                  <button
                    onClick={async () => {
                      setMobileMenuOpen(false)
                      await signOut()
                      nav('/')
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/10 text-white text-center"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#00c8ef] text-royal-950 font-bold text-center"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="no-print bg-[#02091d] text-white/70 border-t border-slate-800 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <img className="h-7 w-7 rounded-md object-cover" src="/favicon/android-chrome-192x192.png" alt="" />
            <div>
              <p className="font-semibold text-white">Research Distinction Awards 2026</p>
              <p className="text-[11px] text-white/50">Organized in academic collaboration with participating global institutions.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <Link to="/results" className="hover:text-[#83eaff] transition-colors">Results &amp; Winners</Link>
            <Link to="/verify" className="hover:text-[#83eaff] transition-colors">Certificate Verification</Link>
            <span className="text-white/30">|</span>
            <span className="text-white/50">&copy; 2026 Research Distinction Awards. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
