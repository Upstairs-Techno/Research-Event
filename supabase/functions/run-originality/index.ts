// Runs plagiarism + AI-content analysis for a submission and stores both reports.
//
// ORIGINALITY_MODE=mock  -> deterministic placeholder scores (development only; clearly labelled mock)
// ORIGINALITY_MODE=http  -> calls the vendor endpoints below. Adapt `callPlagiarism` / `callAi`
//                           to your chosen vendor's request/response format (Copyleaks, Turnitin iThenticate,
//                           Originality.ai, GPTZero, etc.).
//
// Results are ADVISORY. High scores only set submissions.flagged = true for manual review.
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/util.ts'

// deno-lint-ignore no-explicit-any
function extractText(node: any, out: string[] = []): string[] {
  if (!node) return out
  if (node.type === 'text' && node.text) out.push(node.text)
  if (Array.isArray(node.content)) {
    for (const c of node.content) extractText(c, out)
    if (['paragraph', 'heading', 'listItem', 'tableCell', 'tableHeader'].includes(node.type)) out.push('\n')
  }
  return out
}

// deno-lint-ignore no-explicit-any
function sectionsOf(doc: any): { section: string; text: string }[] {
  const sections: { section: string; text: string }[] = []
  let current = { section: 'Front matter', text: '' }
  for (const n of doc?.content ?? []) {
    if (n.type === 'heading') {
      if (current.text.trim()) sections.push(current)
      current = { section: extractText(n).join('').trim() || 'Untitled', text: '' }
    } else {
      current.text += extractText(n).join('') + '\n'
    }
  }
  if (current.text.trim()) sections.push(current)
  return sections
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

async function callPlagiarism(sections: { section: string; text: string }[], full: string) {
  if (Deno.env.get('ORIGINALITY_MODE') !== 'http') {
    const sim = hash(full) % 18
    return {
      score: sim,
      details: {
        mock: true, note: 'MOCK RESULT - configure ORIGINALITY_MODE=http for real analysis.',
        by_section: sections.map((s) => ({ section: s.section, similarity: hash(s.text) % 20 })),
        matches: [], uncredited_quotations: [],
      },
    }
  }
  const res = await fetch(Deno.env.get('PLAGIARISM_API_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('PLAGIARISM_API_KEY')}` },
    body: JSON.stringify({ text: full, sections }),
  })
  if (!res.ok) throw new Error(`Plagiarism API error ${res.status}`)
  const r = await res.json()
  // Expected shape (adapt to your vendor): { similarity, matches:[{text,source,section}], by_section:[], uncredited_quotations:[] }
  return {
    score: Number(r.similarity ?? 0),
    details: {
      matches: r.matches ?? [], by_section: r.by_section ?? [],
      uncredited_quotations: r.uncredited_quotations ?? [], provider: r.provider ?? 'external',
    },
  }
}

async function callAi(full: string) {
  if (Deno.env.get('ORIGINALITY_MODE') !== 'http') {
    return {
      score: hash(full + 'ai') % 25,
      details: { mock: true, note: 'MOCK RESULT - configure ORIGINALITY_MODE=http for real analysis.', passages: [] },
    }
  }
  const res = await fetch(Deno.env.get('AI_DETECTION_API_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('AI_DETECTION_API_KEY')}` },
    body: JSON.stringify({ text: full }),
  })
  if (!res.ok) throw new Error(`AI detection API error ${res.status}`)
  const r = await res.json()
  // Expected shape (adapt): { ai_score (0-100), confidence, passages:[{text, confidence}] }
  return {
    score: Number(r.ai_score ?? 0),
    details: { passages: r.passages ?? [], confidence: r.confidence ?? null, provider: r.provider ?? 'external' },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const user = await getUser(req)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { submission_id } = await req.json()

    const admin = serviceClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    const { data: sub } = await admin
      .from('submissions').select('id, user_id, content').eq('id', submission_id).maybeSingle()
    if (!sub || (sub.user_id !== user.id && !isAdmin)) return json({ error: 'Not found' }, 404)

    // throttle external API usage for participants: one run per 10 minutes
    if (!isAdmin) {
      const { data: last } = await admin.from('originality_reports').select('created_at')
        .eq('submission_id', sub.id).order('created_at', { ascending: false }).limit(1)
      if (last?.[0] && Date.now() - new Date(last[0].created_at).getTime() < 10 * 60 * 1000) {
        return json({ error: 'Please wait 10 minutes between originality checks.' }, 429)
      }
    }

    const sections = sectionsOf(sub.content)
    const full = sections.map((s) => `${s.section}\n${s.text}`).join('\n')
    if (full.trim().split(/\s+/).length < 50) return json({ error: 'Write at least 50 words first.' }, 400)

    const [plag, ai] = await Promise.all([callPlagiarism(sections, full), callAi(full)])

    await admin.from('originality_reports').insert([
      { submission_id: sub.id, kind: 'plagiarism', score: plag.score, details: plag.details },
      { submission_id: sub.id, kind: 'ai', score: ai.score, details: ai.details },
    ])

    const flagged = plag.score >= 30 || ai.score >= 50
    if (flagged) await admin.from('submissions').update({ flagged: true }).eq('id', sub.id)

    return json({ plagiarism: plag.score, ai: ai.score, flagged })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
