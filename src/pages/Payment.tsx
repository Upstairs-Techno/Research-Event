import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate, rupees, useSettings } from '../lib/utils'

declare global { interface Window { Razorpay: any } }  // eslint-disable-line @typescript-eslint/no-explicit-any

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

interface PaymentRow { razorpay_order_id: string; razorpay_payment_id: string | null; amount_paise: number; status: string; paid_at: string | null; created_at: string }

export default function Payment() {
  const { user, fullName } = useAuth()
  const nav = useNavigate()
  const settings = useSettings()
  const [status, setStatus] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    if (!user) return
    const { data: reg } = await supabase.from('registrations').select('status').eq('user_id', user.id).maybeSingle()
    if (!reg) { nav('/complete-registration', { replace: true }); return }
    setStatus(reg.status)
    const { data: pays } = await supabase.from('payments').select('*').order('created_at', { ascending: false })
    setPayments((pays as PaymentRow[]) ?? [])
  }
  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async () => {
    setBusy(true); setMsg('')
    try {
      if (!(await loadCheckout())) throw new Error('Could not load Razorpay. Check your connection.')
      const { data: order, error } = await supabase.functions.invoke('create-order')
      if (error || order?.error) throw new Error(order?.error ?? error?.message ?? 'Could not start payment')

      const rzp = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: 'Research Distinction Awards', description: 'Registration fee',
        prefill: { name: fullName, email: user?.email },
        theme: { color: '#e85d04' },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const { data, error: ve } = await supabase.functions.invoke('verify-payment', { body: resp })
          if (ve || data?.error) setMsg(data?.error ?? ve?.message ?? 'Verification failed')
          else setMsg('Payment verified!')
          await load()
          setBusy(false)
        },
        modal: { ondismiss: () => { setBusy(false); setMsg('Payment was not completed. You can retry anytime.') } },
      })
      rzp.on('payment.failed', () => { setMsg('Payment failed. Please retry.'); setBusy(false); load() })
      rzp.open()
    } catch (e) {
      setMsg((e as Error).message); setBusy(false)
    }
  }

  if (!settings || !status) return <p className="p-10 text-center text-slate-500">Loading…</p>
  const paid = payments.find((p) => p.status === 'paid')

  if (status === 'paid' && paid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="card space-y-3" id="receipt">
          <h1 className="font-serif text-2xl font-bold text-royal-800">Payment receipt</h1>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Paid by</dt><dd>{fullName} ({user?.email})</dd>
            <dt className="text-slate-500">Amount</dt><dd>{rupees(paid.amount_paise)}</dd>
            <dt className="text-slate-500">Order ID</dt><dd className="break-all">{paid.razorpay_order_id}</dd>
            <dt className="text-slate-500">Payment ID</dt><dd className="break-all">{paid.razorpay_payment_id}</dd>
            <dt className="text-slate-500">Date</dt><dd>{fmtDate(paid.paid_at)}</dd>
            <dt className="text-slate-500">Status</dt><dd className="font-semibold text-green-700">Paid</dd>
          </dl>
          <div className="no-print flex gap-2">
            <button className="btn-outline" onClick={() => window.print()}>Print / save PDF</button>
            <Link to="/dashboard" className="btn-primary">Go to dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="card space-y-4">
        <h1 className="font-serif text-2xl font-bold text-royal-800">Pay registration fee</h1>
        <p className="text-sm text-slate-500">Step 3 of 3</p>
        <p className="font-serif text-4xl font-bold text-royal-800">{rupees(settings.fee_paise)}</p>
        <div className="rounded-lg bg-royal-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">Refund &amp; cancellation policy</p>
          <p className="mt-1">{settings.refund_policy}</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          I have read and accept the refund and cancellation policy.
        </label>
        {payments.some((p) => p.status === 'failed') && (
          <p className="text-sm text-amber-700">A previous attempt did not complete. You can retry safely — you are only charged once.</p>
        )}
        {msg && <p role="status" className="text-sm text-royal-800">{msg}</p>}
        <button className="btn-gold w-full" disabled={!agree || busy || !settings.registration_open} onClick={pay}>
          {busy ? 'Processing…' : `Pay ${rupees(settings.fee_paise)} with Razorpay`}
        </button>
        {!settings.registration_open && <p className="text-sm text-red-600">Registration is currently closed.</p>}
      </div>
    </div>
  )
}
