const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://www.research-distinction.upstairstechno.com',
  ...(Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
])

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-webhook-secret',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function corsPreflight(req: Request): Response {
  const allowed = allowedOrigins.has(req.headers.get('origin') ?? '')
  return new Response(null, {
    status: allowed ? 204 : 403,
    headers: corsHeaders(req),
  })
}

export function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(req ? corsHeaders(req) : {}),
      'Content-Type': 'application/json',
    },
  })
}
