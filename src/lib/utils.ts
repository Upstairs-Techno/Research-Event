import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Role = 'participant' | 'judge' | 'admin'

export interface RubricItem { key: string; label: string; weight: number }

export interface Settings {
  name: string
  fee_paise: number
  registration_open: boolean
  submission_deadline: string | null
  competition_starts_at?: string | null
  competition_ends_at?: string | null
  results_announcement_at?: string | null
  results_published: boolean
  refund_policy: string
  rubric: RubricItem[]
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    supabase.from('competition_settings').select('*').eq('id', 1).single()
      .then(({ data }) => setSettings(data as Settings | null))
  }, [])
  return settings
}

// TipTap JSON helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function countWords(doc: any): number {
  let text = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (n?.type === 'text') text += n.text + ' '
    n?.content?.forEach(walk)
  }
  walk(doc)
  return text.trim() ? text.trim().split(/\s+/).length : 0
}
