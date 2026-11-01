// Verifies the Razorpay checkout signature on the server, then marks the registration paid.
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, hmacHex, markPaid, safeEqual, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const user = await getUser(req)
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Missing payment fields' }, 400)
    }

    const admin = serviceClient()
    const { data: payment } = await admin
      .from('payments').select('user_id, status')
      .eq('razorpay_order_id', razorpay_order_id).maybeSingle()
    if (!payment || payment.user_id !== user.id) return json({ error: 'Order not found' }, 404)
    if (payment.status === 'paid') return json({ status: 'paid', duplicate: true })

    const expected = await hmacHex(
      Deno.env.get('RAZORPAY_KEY_SECRET')!, `${razorpay_order_id}|${razorpay_payment_id}`)
    if (!safeEqual(expected, razorpay_signature)) {
      await admin.from('audit_logs').insert({
        actor_id: user.id, action: 'payment.signature_invalid', entity: 'payments', entity_id: razorpay_order_id,
      })
      return json({ error: 'Invalid payment signature' }, 400)
    }

    await markPaid(admin, razorpay_order_id, razorpay_payment_id)
    return json({ status: 'paid' })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
