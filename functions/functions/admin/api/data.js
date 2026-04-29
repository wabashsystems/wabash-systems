// functions/admin/api/data.js
// Serves as the data API for the admin billing tool.
// Reads and writes a single JSON blob to Cloudflare KV (binding: ADMIN_DATA).
//
// GET  /admin/api/data  → returns full data object
// POST /admin/api/data  → overwrites full data object
//
// Protected by _middleware.js in the parent /admin/ directory.

const KV_KEY = 'billing_data';

const EMPTY = JSON.stringify({ clients: [], entries: [], invoices: [] });

const json = (body, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.ADMIN_DATA) {
    return json(JSON.stringify({ error: 'ADMIN_DATA KV binding not configured.' }), 503);
  }
  const data = await env.ADMIN_DATA.get(KV_KEY);
  return json(data || EMPTY);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ADMIN_DATA) {
    return json(JSON.stringify({ error: 'ADMIN_DATA KV binding not configured.' }), 503);
  }
  const body = await request.text();

  // Basic validation — make sure it's parseable JSON with expected keys
  try {
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.entries) || !Array.isArray(parsed.invoices)) {
      return json(JSON.stringify({ error: 'Invalid data structure.' }), 400);
    }
  } catch {
    return json(JSON.stringify({ error: 'Invalid JSON.' }), 400);
  }

  await env.ADMIN_DATA.put(KV_KEY, body);
  return json(JSON.stringify({ ok: true }));
}
