import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../lib/utils'

export default function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, role, accountActive, loading, roleLoading } = useAuth()
  const loc = useLocation()
  if (loading) return <p className="p-10 text-center text-slate-500">Loading…</p>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname, authError: `${loc.search}${loc.hash}` }} replace />
  if (roles && roleLoading) return <p className="p-10 text-center text-slate-500">Verifying access…</p>
  if (roles && (!role || !roles.includes(role))) return <Navigate to="/" replace />
  if (roles?.includes('judge') && role === 'judge' && accountActive !== true) return <Navigate to="/" replace />
  return <>{children}</>
}
