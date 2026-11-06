// Creates a Razorpay order for the signed-in participant's registration.
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const user = await getUser(req)
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const admin = serviceClient()
    const { data: reg } = await admin
      .from('registrations').select('id, status').eq('user_id', user.id).maybeSingle()
    if (!reg) return json({ error: 'Complete your registration first' }, 400)
    if (reg.status === 'paid' || reg.status === 'confirmed') return json({ error: 'Registration already paid' }, 409)

    const { data: settings } = await admin
      .from('competition_settings').select('fee_paise, registration_open').eq('id', 1).single()
    if (!settings?.registration_open) return json({ error: 'Registration is closed' }, 403)

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({
        amount: settings.fee_paise,
        currency: 'INR',
        receipt: reg.id.slice(0, 36),
        notes: { registration_id: reg.id, user_id: user.id },
      }),
    })
    const order = await res.json()
    if (!res.ok) return json({ error: order?.error?.description ?? 'Could not create order' }, 502)

    // A retry after failure simply creates a fresh order; older unpaid ones are marked failed.
    await admin.from('payments').update({ status: 'failed' })
      .eq('registration_id', reg.id).eq('status', 'created')
    const { error } = await admin.from('payments').insert({
      registration_id: reg.id, user_id: user.id, razorpay_order_id: order.id,
      amount_paise: settings.fee_paise, currency: 'INR', status: 'created',
    })
    if (error) throw error

    return json({ order_id: order.id, amount: settings.fee_paise, currency: 'INR', key_id: keyId })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
