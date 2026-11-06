import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/util.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/
const BAN_DURATION = '876000h'

function validPassword(value: unknown): value is string {
  return typeof value === 'string' && PASSWORD_RE.test(value)
}

async function writeAudit(admin: ReturnType<typeof serviceClient>, actor: string, action: string, entityId: string, details: Record<string, unknown> = {}) {
  const { error } = await admin.from('audit_logs').insert({
    actor_id: actor, action, entity: 'judges', entity_id: entityId, details,
  })
  if (error) throw error
}

Deno.serve(async (req: Request) => {
  const respond = (body: unknown, status = 200) => json(body, status, req)
  if (req.method === 'OPTIONS') return corsPreflight(req)
  try {
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const caller = await getUser(req)
  if (!caller) return respond({ error: 'Authentication required' }, 401)

  const admin = serviceClient()
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles').select('role').eq('id', caller.id).maybeSingle()
  if (profileError || callerProfile?.role !== 'admin') return respond({ error: 'Administrator access required' }, 403)

  let input: Record<string, unknown>
  try { input = await req.json() } catch { return respond({ error: 'Invalid request body' }, 400) }
  const action = input.action

  try {
    if (action === 'list') {
      const { data: judges, error } = await admin.from('judges').select('user_id, created_at').order('created_at', { ascending: false })
      if (error) throw error
      const ids = (judges ?? []).map((j) => j.user_id)
      if (!ids.length) return respond({ judges: [] })

      const [{ data: profiles, error: profilesError }, { data: assignments, error: assignmentsError }, { data: evaluations, error: evaluationsError }] = await Promise.all([
        admin.from('profiles').select('id, full_name, email, role, account_active, created_at').in('id', ids),
        admin.from('judge_assignments').select('judge_id, submission_id').in('judge_id', ids),
        admin.from('evaluations').select('judge_id, submission_id, status').in('judge_id', ids),
      ])
      if (profilesError || assignmentsError || evaluationsError) throw profilesError || assignmentsError || evaluationsError

      const submissionIds = [...new Set((assignments ?? []).map((a) => a.submission_id))]
      const { data: submissions, error: submissionsError } = submissionIds.length
        ? await admin.from('submissions').select('id, title').in('id', submissionIds)
        : { data: [], error: null }
      if (submissionsError) throw submissionsError
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      const submissionMap = new Map((submissions ?? []).map((s) => [s.id, s]))

      const rows = await Promise.all((judges ?? []).filter((judge) => profileMap.get(judge.user_id)?.role === 'judge').map(async (judge) => {
        const profile = profileMap.get(judge.user_id)
        const [{ data: authResult, error: authError }] = await Promise.all([
          admin.auth.admin.getUserById(judge.user_id),
        ])
        if (authError) throw authError
        const judgeAssignments = (assignments ?? []).filter((a) => a.judge_id === judge.user_id)
        const judgeEvaluations = (evaluations ?? []).filter((e) => e.judge_id === judge.user_id)
        const submittedIds = new Set(judgeEvaluations.filter((e) => e.status === 'submitted').map((e) => e.submission_id))
        const pendingCount = judgeAssignments.filter((a) => !submittedIds.has(a.submission_id)).length
        return {
          id: judge.user_id,
          full_name: profile?.full_name ?? '',
          email: profile?.email ?? '',
          account_active: profile?.account_active ?? false,
          created_at: profile?.created_at ?? judge.created_at,
          last_sign_in_at: authResult.user.last_sign_in_at ?? null,
          assigned_papers: judgeAssignments.map((a) => ({ id: a.submission_id, title: submissionMap.get(a.submission_id)?.title ?? 'Untitled submission' })),
          evaluation_count: judgeEvaluations.length,
          completed_evaluations: judgeEvaluations.filter((e) => e.status === 'submitted').length,
          pending_evaluations: pendingCount,
        }
      }))
      return respond({ judges: rows })
    }

    if (action === 'create') {
      const fullName = String(input.fullName ?? '').trim()
      const email = String(input.email ?? '').trim().toLowerCase()
      const password = input.password
      if (!fullName || !email || !password) return respond({ error: 'Full name, email, and password are required' }, 400)
      if (fullName.length > 120 || email.length > 254) return respond({ error: 'Name or email address is too long' }, 400)
      if (!EMAIL_RE.test(email)) return respond({ error: 'Enter a valid email address' }, 400)
      if (!validPassword(password)) return respond({ error: 'Password must be 12+ characters and include uppercase, lowercase, number, and symbol' }, 400)

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: fullName },
      })
      if (createError || !created.user) {
        const message = createError?.message ?? 'Could not create authentication account'
        const alreadyExists = /already been registered|already exists|user already registered/i.test(message)
        return respond({
          error: alreadyExists
            ? 'An account with this email already exists. Use “Promote to Judge” in Judge Management to grant judge access to that registered account.'
            : message,
          code: alreadyExists ? 'USER_ALREADY_EXISTS' : undefined,
          suggestion: alreadyExists ? 'promote_existing_user' : undefined,
        }, alreadyExists ? 409 : 400)
      }

      const userId = created.user.id
      const { error: profileUpsertError } = await admin.from('profiles').upsert({
        id: userId, email, full_name: fullName, role: 'judge', account_active: true,
      }, { onConflict: 'id' })
      if (profileUpsertError) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(userId)
        throw new Error(`Profile creation failed: ${profileUpsertError.message}${rollbackError ? `; auth-user rollback failed: ${rollbackError.message}` : ''}`)
      }
      const { error: judgeUpsertError } = await admin.from('judges').upsert({ user_id: userId }, { onConflict: 'user_id' })
      if (judgeUpsertError) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(userId)
        throw new Error(`Judge record creation failed: ${judgeUpsertError.message}${rollbackError ? `; auth-user rollback failed: ${rollbackError.message}` : ''}`)
      }
      try {
        await writeAudit(admin, caller.id, 'judge.created', userId, { email, full_name: fullName })
      } catch (auditError) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(userId)
        const message = auditError instanceof Error ? auditError.message : String(auditError)
        throw new Error(`Audit log creation failed: ${message}${rollbackError ? `; auth-user rollback failed: ${rollbackError.message}` : ''}`)
      }
      return respond({ success: true, user_id: userId })
    }

    const userId = String(input.userId ?? '')
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) return respond({ error: 'A valid judge account ID is required' }, 400)
    const { data: profile, error: judgeError } = await admin.from('profiles')
      .select('id, email, full_name, role, account_active').eq('id', userId).maybeSingle()
    if (judgeError) throw judgeError
    if (!profile || profile.role !== 'judge') return respond({ error: 'Judge account not found' }, 404)
    const { data: judgeRow, error: judgeRowError } = await admin.from('judges').select('user_id').eq('user_id', userId).maybeSingle()
    if (judgeRowError) throw judgeRowError
    if (!judgeRow) return respond({ error: 'Judge account not found' }, 404)

    if (action === 'update') {
      const fullName = String(input.fullName ?? '').trim()
      const email = String(input.email ?? '').trim().toLowerCase()
      if (!fullName || !email) return respond({ error: 'Full name and email are required' }, 400)
      if (fullName.length > 120 || email.length > 254) return respond({ error: 'Name or email address is too long' }, 400)
      if (!EMAIL_RE.test(email)) return respond({ error: 'Enter a valid email address' }, 400)
      const { data: authUser, error: getAuthError } = await admin.auth.admin.getUserById(userId)
      if (getAuthError) throw getAuthError
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
        email, email_confirm: true, user_metadata: { ...authUser.user.user_metadata, full_name: fullName },
      })
      if (authUpdateError) return respond({ error: authUpdateError.message }, 409)
      const accountActive = typeof input.accountActive === 'boolean' ? input.accountActive : profile.account_active
      if (accountActive && !profile.account_active) {
        const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
        if (unbanError) return respond({ error: unbanError.message }, 500)
      }
      const { error: updateError } = await admin.from('profiles').update({ email, full_name: fullName, account_active: accountActive }).eq('id', userId)
      if (updateError) {
        await admin.auth.admin.updateUserById(userId, { email: authUser.user.email!, email_confirm: true, user_metadata: authUser.user.user_metadata })
        throw updateError
      }
      if (!accountActive && profile.account_active) {
        const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION })
        if (banError) {
          await writeAudit(admin, caller.id, 'judge.deactivated', userId, { email, auth_ban_failed: true })
          return respond({ error: `Database access is disabled, but Auth could not complete the sign-in ban: ${banError.message}` }, 500)
        }
      }
      await writeAudit(admin, caller.id, 'judge.updated', userId, {
        email_changed: profile.email !== email, full_name_changed: profile.full_name !== fullName,
        status_changed: profile.account_active !== accountActive, account_active: accountActive,
      })
      return respond({ success: true })
    }

    if (action === 'set_status') {
      if (typeof input.active !== 'boolean') return respond({ error: 'Account status is required' }, 400)
      if (input.active) {
        const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
        if (unbanError) throw unbanError
      }
      const { error: statusError } = await admin.from('profiles').update({ account_active: input.active }).eq('id', userId)
      if (statusError) throw statusError
      if (!input.active) {
        const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION })
        if (banError) {
          await writeAudit(admin, caller.id, 'judge.deactivated', userId, { email: profile.email, auth_ban_failed: true })
          return respond({ error: `Database access is disabled, but Auth could not complete the sign-in ban: ${banError.message}` }, 500)
        }
      }
      await writeAudit(admin, caller.id, input.active ? 'judge.activated' : 'judge.deactivated', userId, { email: profile.email })
      return respond({ success: true, account_active: input.active })
    }

    if (action === 'reset_password') {
      if (!validPassword(input.password)) return respond({ error: 'Password must be 12+ characters and include uppercase, lowercase, number, and symbol' }, 400)
      const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password: input.password })
      if (passwordError) return respond({ error: passwordError.message }, 400)
      await writeAudit(admin, caller.id, 'judge.password_reset', userId)
      return respond({ success: true })
    }

    if (action === 'delete') {
      const references = await Promise.all([
        admin.from('judge_assignments').select('id', { count: 'exact', head: true }).eq('judge_id', userId),
        admin.from('evaluations').select('id', { count: 'exact', head: true }).eq('judge_id', userId),
        admin.from('participants').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        admin.from('registrations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        admin.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        admin.from('submissions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        admin.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        admin.from('participant_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ])
      const referenceError = references.find((result) => result.error)?.error
      if (referenceError) throw referenceError
      if (references.some((result) => (result.count ?? 0) > 0)) {
        return respond({ error: 'This account has linked assignments, evaluations, or participant records. Deactivate it to preserve all history.' }, 409)
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) throw deleteError
      await writeAudit(admin, caller.id, 'judge.deleted', userId, { email: profile.email })
      return respond({ success: true })
    }

    return respond({ error: 'Unsupported action' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('admin-judge-management operation failed:', message, error)
    return respond({ error: `Judge management operation failed: ${message}` }, 500)
  }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('admin-judge-management request failed:', message, error)
    return respond({ error: `Judge management request failed: ${message}` }, 500)
  }
})
