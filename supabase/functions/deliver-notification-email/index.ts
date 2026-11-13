// Database Webhook handler for durable participant email notifications.
// Configure an INSERT webhook on public.email_outbox and set EMAIL_WEBHOOK_SECRET,
// RESEND_API_KEY, and RESEND_FROM_EMAIL as Supabase secrets.
import { corsPreflight, json as jsonResponse } from '../_shared/cors.ts'
import { serviceClient, safeEqual } from '../_shared/util.ts'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!))

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => jsonResponse(body, status, req)
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const expected = Deno.env.get('EMAIL_WEBHOOK_SECRET')
  const provided = req.headers.get('x-webhook-secret') ?? ''
  if (!expected || !safeEqual(expected, provided)) return json({ error: 'Unauthorized webhook' }, 401)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !from) return json({ error: 'Email provider is not configured' }, 503)
  const payload = await req.json().catch(() => ({}))
  const outboxId = payload.record?.id
  if (!outboxId) return json({ error: 'Missing outbox record id' }, 400)

  const db = serviceClient()
  const { data: row, error: readError } = await db.from('email_outbox').select('id,status,notification_id,attempts').eq('id', outboxId).maybeSingle()
  if (readError || !row) return json({ error: readError?.message ?? 'Outbox record not found' }, 404)
  if (row.status === 'sent') return json({ status: 'sent', duplicate: true })
  const { data: notification } = await db.from('participant_notifications').select('title,message,kind,details,profiles(email,full_name)').eq('id', row.notification_id).single()
  const profile = (notification as any)?.profiles
  if (!notification || !profile?.email) return json({ error: 'Recipient details unavailable' }, 404)

  const attempts = (row as any).attempts ?? 0
  const { error: mailError } = await db.from('email_outbox').update({ status: 'pending', attempts: attempts + 1 }).eq('id', row.id)
  if (mailError) return json({ error: mailError.message }, 500)
  const details = (notification as any).details ?? {}
  const confirmationHtml = notification.kind === 'registration_confirmation' ? `
    <h1>Payment Successful</h1>
    <p>Dear ${escapeHtml(details.participant_name ?? profile.full_name ?? 'Participant')},</p>
    <p>Your payment has been verified and your registration for ${escapeHtml(details.competition_name ?? 'Research Distinction Awards')} is confirmed.</p>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Participant</strong></td><td>${escapeHtml(details.participant_name ?? profile.full_name ?? '')}</td></tr>
      <tr><td><strong>Registered email</strong></td><td>${escapeHtml(details.email ?? profile.email)}</td></tr>
      <tr><td><strong>Registration ID</strong></td><td>${escapeHtml(details.registration_id ?? '')}</td></tr>
      <tr><td><strong>Participant ID</strong></td><td>${escapeHtml(details.participant_code ?? '')}</td></tr>
      <tr><td><strong>Competition</strong></td><td>${escapeHtml(details.competition_name ?? 'Research Distinction Awards')}</td></tr>
      <tr><td><strong>Project title</strong></td><td>${escapeHtml(details.project_title ?? 'Unavailable')}</td></tr>
      <tr><td><strong>Payment amount</strong></td><td>${escapeHtml(details.currency ?? 'INR')} ${((Number(details.amount_paise) || 0) / 100).toFixed(2)}</td></tr>
      <tr><td><strong>Payment reference</strong></td><td>${escapeHtml(details.payment_reference ?? 'Unavailable')}</td></tr>
      <tr><td><strong>Status</strong></td><td>${escapeHtml(details.confirmation_status ?? 'CONFIRMED')}</td></tr>
      <tr><td><strong>Payment date</strong></td><td>${escapeHtml(details.paid_at ? new Date(details.paid_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Unavailable')}</td></tr>
    </table>
    <h2>Next steps</h2>
    <p>Sign in to your participant dashboard to review your registration details, competition announcements, research submission instructions, and important deadlines. Keep your registration and payment references for your records.</p>
    <p>Regards,<br/>Research Distinction Awards Team</p>` : `<p>${escapeHtml(notification.message)}</p><p>Research Distinction Awards</p>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': row.id },
    body: JSON.stringify({ from, to: [profile.email], subject: notification.title,
      html: confirmationHtml }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    await db.from('email_outbox').update({ status: 'failed', last_error: String(result.message ?? response.statusText).slice(0, 1000) }).eq('id', row.id)
    return json({ error: result.message ?? 'Email provider rejected the message' }, 502)
  }
  await db.from('email_outbox').update({ status: 'sent', last_error: null, sent_at: new Date().toISOString() }).eq('id', row.id)
  return json({ status: 'sent' })
})
