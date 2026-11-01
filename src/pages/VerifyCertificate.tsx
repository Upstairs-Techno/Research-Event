import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function VerifyCertificate() {
  const { code: param } = useParams()
  const nav = useNavigate()
  const [code, setCode] = useState(param ?? '')
  const [cert, setCert] = useState<any>(null)
  const [state, setState] = useState<'idle' | 'found' | 'missing'>('idle')

  const lookup = async (c: string) => {
    const { data } = await supabase.rpc('verify_certificate', { p_code: c })
    const row = Array.isArray(data) ? data[0] : data
    if (row) { setCert(row); setState('found') } else { setCert(null); setState('missing') }
  }
  useEffect(() => { if (param) lookup(param) }, [param])

  const submit = (e: FormEvent) => { e.preventDefault(); if (code.trim()) nav(`/verify/${code.trim()}`) }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <form onSubmit={submit} className="no-print card flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="code" className="label">Certificate ID</label>
          <input id="code" className="input" placeholder="RDA-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="btn-primary">Verify</button>
      </form>

      {state === 'missing' && <p role="alert" className="text-center text-red-600">No certificate found with that ID.</p>}

      {state === 'found' && cert && (
        <>
          <p className="no-print text-center text-sm font-medium text-green-700">✓ This certificate is authentic.</p>
          <div className="border-[10px] border-double border-gold-500 bg-white p-10 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-gold-600">{cert.competition}</p>
            <h1 className="mt-4 font-serif text-4xl font-bold text-royal-800">{cert.award}</h1>
            <p className="mt-6 text-slate-500">This is proudly presented to</p>
            <p className="mt-2 font-serif text-3xl font-bold text-royal-900">{cert.holder_name}</p>
            <p className="mt-6 text-sm text-slate-600">in recognition of research submitted to the {cert.competition}.</p>
            <p className="mt-8 text-xs text-slate-500">Certificate ID: <b>{cert.certificate_code}</b> · Issued {fmtDate(cert.issued_at)}</p>
          </div>
          <div className="no-print text-center"><button className="btn-outline" onClick={() => window.print()}>Print / save as PDF</button></div>
        </>
      )}
    </div>
  )
}
