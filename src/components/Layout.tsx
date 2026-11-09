import { Link, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const dashboardByRole = {
  admin: { label: 'Admin Dashboard', href: '/admin' },
  judge: { label: 'Judge Dashboard', href: '/judge' },
  participant: { label: 'Participant Dashboard', href: '/dashboard' },
} as const

export default function Layout() {
  const { user, role, fullName, loading, roleLoading, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const displayName = fullName || user?.email?.split('@')[0] || 'My account'

  useEffect(() => {
    if (!profileOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileOpen])

  const handleSignOut = async () => {
    setProfileOpen(false)
    await signOut()
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50">
      <header className="portal-header no-print sticky top-0 z-50 backdrop-blur-md">
        <div className="portal-header-inner mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          {/* Brand */}
          <Link to="/" className="portal-header-brand flex min-w-0 items-center gap-3 group">
              <div className="portal-logo relative flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 p-1 border border-gold-500/40 shadow-sm group-hover:scale-105 transition-transform">
              <img
                className="h-full w-full object-cover rounded-lg"
                src="/favicon/android-chrome-192x192.png"
                alt="Research Distinction Awards"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-base sm:text-lg font-bold tracking-tight text-royal-900 group-hover:text-royal-700 transition-colors">
                Research Distinction Awards
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-royal-700">
                Academic Competition &amp; Portal
              </span>
            </div>
          </Link>

          <nav aria-label="Account" className="portal-account-nav flex shrink-0 items-center gap-2 sm:gap-3">
            {!loading && !user && <>
              <Link to="/login" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-stone-800 hover:border-gold-500 hover:bg-orange-50 sm:px-4">Log In</Link>
              <Link to="/register" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-royal-700 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-royal-800 sm:px-4">Register</Link>
            </>}
            {!loading && user && <div ref={profileMenuRef} className="relative">
              <button type="button" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)} className="inline-flex min-h-10 max-w-[min(52vw,280px)] items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-xs font-semibold text-royal-950 shadow-sm hover:border-gold-500 hover:bg-orange-50 sm:px-4">
                <UserRound className="h-4 w-4 shrink-0 text-gold-600"/><span className="truncate">{displayName}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-[60] w-60 overflow-hidden rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
                <div className="border-b border-stone-100 px-3 py-2"><p className="truncate text-xs font-bold text-royal-950">{displayName}</p><p className="truncate text-[11px] text-slate-500">{user.email}</p></div>
                {!roleLoading && role && <Link role="menuitem" to={dashboardByRole[role].href} onClick={() => setProfileOpen(false)} className="mt-1 flex items-center rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-royal-50 hover:text-royal-900">{dashboardByRole[role].label}</Link>}
                <button role="menuitem" type="button" onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"><LogOut className="h-4 w-4"/>Log out</button>
              </div>}
            </div>}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="portal-footer no-print border-t border-stone-800 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <img className="h-7 w-7 rounded-md object-cover" src="/favicon/android-chrome-192x192.png" alt="" />
            <div>
              <p className="font-semibold text-white">Research Distinction Awards 2026</p>
              <p className="text-[11px] text-stone-300">Organized in academic collaboration with participating global institutions.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <Link to="/results" className="hover:text-orange-300 transition-colors">Results &amp; Winners</Link>
            <Link to="/verify" className="hover:text-orange-300 transition-colors">Certificate Verification</Link>
            <span className="text-stone-400">|</span>
            <span className="text-stone-300">&copy; 2026 Research Distinction Awards. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
