// Razorpay webhook: safety net if the browser closes before verify-payment runs.
// Configure in the Razorpay dashboard: event payment.captured (and order.paid) -> this function's URL.
import { hmacHex, markPaid, safeEqual, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const expected = await hmacHex(Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!, body)
  if (!safeEqual(expected, signature)) return new Response('invalid signature', { status: 400 })

  const event = JSON.parse(body)
  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const p = event.payload?.payment?.entity
    if (p?.order_id && p?.id) await markPaid(serviceClient(), p.order_id, p.id)
  } else if (event.event === 'payment.failed') {
    const p = event.payload?.payment?.entity
    if (p?.order_id) {
      await serviceClient().from('payments').update({ status: 'failed' })
        .eq('razorpay_order_id', p.order_id).eq('status', 'created')
    }
  }
  return new Response('ok')
})
