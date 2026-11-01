import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/utils'

interface Ctx {
  session: Session | null
  user: User | null
  role: Role | null
  fullName: string
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<Ctx>({
  session: null, user: null, role: null, fullName: '', loading: true, signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) { setRole(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return
    setLoading(true)
    supabase.from('profiles').select('role, full_name').eq('id', uid).single()
      .then(({ data }) => {
        setRole((data?.role as Role) ?? 'participant')
        setFullName(data?.full_name ?? '')
        setLoading(false)
      })
  }, [uid])

  return (
    <AuthContext.Provider
      value={{
        session, user: session?.user ?? null, role, fullName, loading,
        signOut: async () => { await supabase.auth.signOut() },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
