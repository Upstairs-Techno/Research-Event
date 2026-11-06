import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/utils'

interface Ctx {
  session: Session | null
  user: User | null
  role: Role | null
  accountActive: boolean | null
  fullName: string
  loading: boolean
  roleLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<Ctx>({
  session: null, user: null, role: null, accountActive: null, fullName: '', loading: true, roleLoading: true, signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [accountActive, setAccountActive] = useState<boolean | null>(null)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(true)
  const sessionUserId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const nextUserId = data.session?.user.id ?? null
      const identityChanged = nextUserId !== sessionUserId.current
      sessionUserId.current = nextUserId
      setSession(data.session)
      if (!data.session) {
        setRole(null); setAccountActive(null); setLoading(false); setRoleLoading(false)
      } else if (identityChanged) {
        setRole(null); setAccountActive(null)
        setLoading(true); setRoleLoading(true)
      }
    }).catch(() => {
      if (active) { sessionUserId.current = null; setSession(null); setRole(null); setAccountActive(null); setRoleLoading(false); setLoading(false) }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
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
    supabase.from('profiles').select('role, full_name, account_active').eq('id', uid).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        const validRoles: Role[] = ['participant', 'judge', 'admin']
        setRole(!error && data && validRoles.includes(data.role as Role) ? data.role as Role : null)
        setAccountActive(!error && data && typeof data.account_active === 'boolean' ? data.account_active : null)
        setFullName(!error && data ? data.full_name ?? '' : '')
        setRoleLoading(false)
        setLoading(false)
      }, () => {
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
        session, user: session?.user ?? null, role, accountActive, fullName,
        loading, roleLoading,
        signOut: async () => { await supabase.auth.signOut() },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
