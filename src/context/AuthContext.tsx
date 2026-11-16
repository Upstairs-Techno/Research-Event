import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/utils'

interface Ctx {
  session: Session | null
  user: User | null
  role: Role | null
  accountActive: boolean | null
  recoverySession: boolean
  fullName: string
  loading: boolean
  roleLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<Ctx>({
  session: null, user: null, role: null, accountActive: null, recoverySession: false, fullName: '', loading: true, roleLoading: true, signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [accountActive, setAccountActive] = useState<boolean | null>(null)
  const [recoverySession, setRecoverySession] = useState(false)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(true)
  const sessionUserId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    const recoveryMarker = 'rda-password-recovery'
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const nextUserId = data.session?.user.id ?? null
      const identityChanged = nextUserId !== sessionUserId.current
      sessionUserId.current = nextUserId
      setSession(data.session)
      setRecoverySession(Boolean(data.session && window.sessionStorage.getItem(recoveryMarker) === data.session.user.id))
      if (!data.session) {
        window.sessionStorage.removeItem(recoveryMarker)
        setRole(null); setAccountActive(null); setLoading(false); setRoleLoading(false)
      } else if (identityChanged) {
        setRole(null); setAccountActive(null)
        setLoading(true); setRoleLoading(true)
      }
    }).catch(() => {
      if (active) { sessionUserId.current = null; setSession(null); setRole(null); setAccountActive(null); setRoleLoading(false); setLoading(false) }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY' && s) {
        window.sessionStorage.setItem(recoveryMarker, s.user.id)
        setRecoverySession(true)
      } else if (event === 'SIGNED_OUT' || !s) {
        window.sessionStorage.removeItem(recoveryMarker)
        setRecoverySession(false)
      }
      const nextUserId = s?.user.id ?? null
      if (nextUserId !== sessionUserId.current) {
        sessionUserId.current = nextUserId
        setRole(null)
        setAccountActive(null)
        if (s) { setLoading(true); setRoleLoading(true) }
        else { setRoleLoading(false); setLoading(false) }
      }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    let active = true
    if (!uid) { setRole(null); setAccountActive(null); setFullName(''); setRoleLoading(false); return }
    setRole(null)
    setAccountActive(null)
    setRoleLoading(true)
    setLoading(true)
    supabase.functions.invoke('account-context').then(async ({ data, error }) => {
        if (!active) return
        let account = data
        if (error || !account) {
          // Keep admin/participant login working before account-context is
          // deployed. This query uses columns available in the base schema.
          const fallback = await supabase.from('profiles').select('role, full_name').eq('id', uid).maybeSingle()
          if (fallback.error || !fallback.data) throw fallback.error ?? new Error('Account profile unavailable')
          account = { ...fallback.data, account_active: fallback.data.role === 'judge' ? false : true }
        }
        const validRoles: Role[] = ['participant', 'judge', 'admin']
        const resolvedRole = validRoles.includes(account.role as Role) ? account.role as Role : null
        setRole(resolvedRole)
        setAccountActive(resolvedRole === 'judge' && typeof account.account_active === 'boolean' ? account.account_active : resolvedRole === 'judge' ? null : true)
        setFullName(account.full_name ?? '')
        setRoleLoading(false)
        setLoading(false)
      }).catch(() => {
        if (!active) return
        setRole(null)
        setAccountActive(null)
        setFullName('')
        setRoleLoading(false)
        setLoading(false)
      })
    return () => { active = false }
  }, [uid])

  return (
    <AuthContext.Provider
      value={{
        session, user: session?.user ?? null, role, accountActive, recoverySession, fullName,
        loading, roleLoading,
        signOut: async () => { await supabase.auth.signOut() },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
