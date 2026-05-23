import { captureException } from '../lib/sentry.js';

const KLAVIYO_LIST_ID = 'TbWzci';
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h
const RATE_LIMIT_PER_HOUR = 30;

/**
 * POST /api/audit
 *
 * Two flows, switched by body shape:
 *   { url }                       -> run a free audit. Cached in KV (24h), rate-limited (30/hr/IP).
 *   { url, email, audit_id }      -> email-gate: subscribe to Klaviyo, write a
 *                                    lead to lamp, fire "Self-Serve Audit Completed".
 *
 * Returns:
 *   { ok: true, audit_id, score, platform, top_issues[], screenshot_url, opportunity_hook, cached? }
 *   { ok: false, error: 'rate_limited'|'invalid_url'|... }
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const url = String(body.url || '').trim();
    const email = String(body.email || '').trim();
    const audit_id = Number(body.audit_id || 0);

    if (!url) {
      return jres({ ok: false, error: 'missing_url' }, 400);
    }

    const normalized = normalizeUrl(url);
    if (!normalized) {
      return jres({ ok: false, error: 'invalid_url' }, 400);
    }

    // Email-gate path: visitor has the audit, now claiming the full report.
    if (email) {
      if (!isValidEmail(email)) {
        return jres({ ok: false, error: 'invalid_email' }, 400);
      }
      const gated = await captureLead(env, normalized, email, audit_id, context);
      return jres(gated, gated.ok ? 200 : 502);
    }

    // Free-audit path: rate-limit + cache + call lamp.
    const ip = getClientIp(request);
    const limited = await checkRateLimit(env, ip);
    if (!limited.ok) {
      return jres({ ok: false, error: 'rate_limited', retry_after_seconds: limited.retry_after }, 429);
    }

    const cacheKey = await sha256(`audit:${normalized}`);
    if (env.ADMIN_DATA) {
      const cached = await env.ADMIN_DATA.get(cacheKey, 'json');
      if (cached) {
        return jres({ ...cached, cached: true });
      }
    }

    const lampResp = await fetch('https://admin.wabashsystems.com/api/public_audit.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.LAMP_API_SECRET}`,
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({ url: normalized }),
    });
    const lampData = await lampResp.json().catch(() => ({}));
    if (!lampResp.ok || !lampData.ok) {
      // Pass through lamp's error so the UI can show something specific.
      return jres(lampData.ok === false ? lampData : { ok: false, error: 'audit_failed' },
                  lampResp.ok ? 200 : 502);
    }

    if (env.ADMIN_DATA) {
      await env.ADMIN_DATA.put(cacheKey, JSON.stringify(lampData), { expirationTtl: CACHE_TTL_SECONDS });
    }
    return jres(lampData);
  } catch (err) {
    captureException(context, err, { tags: { route: 'audit' } });
    return jres({ ok: false, error: 'internal', detail: err?.message || String(err) }, 500);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function jres(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeUrl(input) {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase();
    if (['localhost', 'localhost.localdomain', '0.0.0.0'].includes(host)) return null;
    // Loopback / private CIDRs that the parser will accept as hostnames.
    if (/^(127|10|169\.254)\./.test(host)) return null;
    if (/^192\.168\./.test(host)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
      || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
      || '0.0.0.0';
}

async function sha256(input) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkRateLimit(env, ip) {
  if (!env.ADMIN_DATA) return { ok: true, retry_after: 0 };
  const hourBucket = Math.floor(Date.now() / 3600000);
  const key = `ratelimit:audit:${ip}:${hourBucket}`;
  const current = await env.ADMIN_DATA.get(key);
  const n = current ? Number(current) : 0;
  if (n >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, retry_after: 3600 - Math.floor((Date.now() % 3600000) / 1000) };
  }
  // expirationTtl of 1h is more than enough -- bucket key changes hourly anyway.
  await env.ADMIN_DATA.put(key, String(n + 1), { expirationTtl: 3700 });
  return { ok: true, retry_after: 0 };
}

async function captureLead(env, normalized, email, audit_id, context) {
  // Pull cached audit summary so Klaviyo + lamp lead get the right data.
  let auditSummary = null;
  if (env.ADMIN_DATA) {
    try {
      const cacheKey = await sha256(`audit:${normalized}`);
      auditSummary = await env.ADMIN_DATA.get(cacheKey, 'json');
    } catch {
      auditSummary = null;
    }
  }
  const score = auditSummary?.score ?? null;
  const platform = auditSummary?.platform ?? null;

  // 1. Klaviyo profile + subscription + list-add (same dance as contact.js).
  if (env.KLAVIYO_PRIVATE_KEY) {
    const kHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'revision': '2024-02-15',
      'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
    };
    try {
      await fetch('https://a.klaviyo.com/api/profile-import/', {
        method: 'POST',
        headers: kHeaders,
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              email,
              properties: {
                'Source': 'Self-Serve Audit',
                'Audit URL': normalized,
                ...(score !== null && { 'Audit Score': score }),
                ...(platform && { 'Audit Platform': platform }),
              },
            },
          },
        }),
      });
    } catch (e) {
      console.error('[audit] klaviyo profile import:', e?.message || e);
    }
    try {
      await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
        method: 'POST',
        headers: kHeaders,
        body: JSON.stringify({
          data: {
            type: 'profile-subscription-bulk-create-job',
            attributes: {
              profiles: { data: [{ type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] },
            },
            relationships: { list: { data: { type: 'list', id: KLAVIYO_LIST_ID } } },
          },
        }),
      });
    } catch (e) {
      console.error('[audit] klaviyo subscribe:', e?.message || e);
    }
    // Self-Serve Audit Completed event (uses 2024-10-15 revision per klaviyo_events.php pattern).
    try {
      await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: { ...kHeaders, 'revision': '2024-10-15' },
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              properties: {
                'audit_url': normalized,
                ...(score !== null && { 'audit_score': score }),
                ...(platform && { 'audit_platform': platform }),
                ...(audit_id && { 'audit_id': audit_id }),
              },
              metric: { data: { type: 'metric', attributes: { name: 'Self-Serve Audit Completed' } } },
              profile: { data: { type: 'profile', attributes: { email } } },
            },
          },
        }),
      });
    } catch (e) {
      console.error('[audit] klaviyo event:', e?.message || e);
    }
  }

  // 2. lamp lead row.
  if (env.LAMP_API_SECRET) {
    try {
      await fetch('https://admin.wabashsystems.com/api/leads.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.LAMP_API_SECRET}`,
        },
        body: JSON.stringify({
          fname: '',
          lname: '',
          email,
          business: '',
          service: 'Self-serve audit',
          message: `Self-serve audit captured.\nURL: ${normalized}\nScore: ${score ?? 'unknown'}\nPlatform: ${platform ?? 'unknown'}\nAudit ID: ${audit_id || 'n/a'}`,
          source: 'self_serve_audit',
        }),
      });
    } catch (e) {
      console.error('[audit] lamp lead post:', e?.message || e);
    }
  }

  return { ok: true, email_captured: true };
}
