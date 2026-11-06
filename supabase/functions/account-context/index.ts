import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const user = await getUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const admin = serviceClient()
  const { data: profile, error } = await admin.from('profiles')
    .select('role, full_name').eq('id', user.id).maybeSingle()
  if (error || !profile) return json({ error: 'Account profile could not be loaded' }, 503)
  if (!['participant', 'judge', 'admin'].includes(profile.role)) return json({ error: 'Invalid account role' }, 403)

  // account_active was introduced by migration 007. If it is unavailable,
  // keep normal participant/admin login working and deny judge access closed.
  let accountActive = true
  if (profile.role === 'judge') {
    const { data: status, error: statusError } = await admin.from('profiles')
      .select('account_active').eq('id', user.id).maybeSingle()
    accountActive = !statusError && status?.account_active === true
  }

  return json({
    role: profile.role,
    full_name: profile.full_name ?? '',
    account_active: accountActive,
  })
})
