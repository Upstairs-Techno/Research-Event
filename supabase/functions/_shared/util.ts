import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

/** Returns the authenticated user from the request's JWT, or null. */
export async function getUser(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth) return null
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await client.auth.getUser()
  return error ? null : data.user
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/**
 * Idempotently marks an order paid. Safe to call from both verify-payment and the webhook:
 * only the first call flips the row, later calls are no-ops (duplicate-payment protection).
 */
export async function markPaid(admin: SupabaseClient, orderId: string, paymentId: string) {
  const { data: updated, error } = await admin
    .from('payments')
    .update({ status: 'paid', razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq('razorpay_order_id', orderId)
    .neq('status', 'paid')
    .select('registration_id')
  if (error) throw error
  if (updated && updated.length > 0) {
    await admin.from('registrations').update({ status: 'paid' }).eq('id', updated[0].registration_id)
    await admin.from('audit_logs').insert({
      action: 'payment.verified', entity: 'payments', entity_id: orderId, details: { paymentId },
    })
    return true
  }
  return false
}
