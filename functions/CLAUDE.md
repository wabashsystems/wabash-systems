# Pages Functions — Context

Cloudflare Pages Functions for wabashsystems.com. Two namespaces: public `api/` and auth-gated `admin/api/`.

## Routing

Pages Functions auto-route from filesystem:
- `functions/api/contact.js` → `POST /api/contact`
- `functions/admin/login.js` → `POST /admin/login`
- `functions/admin/api/data.js` → admin data CRUD
- `functions/_middleware.js` → runs on every request (Sentry init, etc.)
- `functions/admin/_middleware.js` → admin auth gate (TOTP)

## Env vars (set in Cloudflare Pages → Settings → Variables)

| Name                  | Purpose                                    |
|-----------------------|--------------------------------------------|
| `RESEND_API_KEY`      | Transactional email (contact notifs)       |
| `KLAVIYO_PRIVATE_KEY` | Klaviyo private API key                    |
| `KLAVIYO_LIST_ID`     | Email List ID (currently wrong — see notes)|
| `ADMIN_TOTP_SECRET`   | TOTP shared secret for admin auth          |
| `ADMIN_DATA`          | KV namespace binding for billing/leads     |
| `SENTRY_DSN`          | Server-side Sentry (via `lib/sentry.js`)   |

**Pages Functions evaluate env vars at deploy time, NOT at runtime.** Changing an env var in the dashboard requires a redeploy to take effect.

## Klaviyo integration (`api/contact.js`)

Three-call belt + suspenders, all idempotent:

1. **Profile import** — `POST /api/profile-import/` (revision `2024-02-15`). Creates or updates the profile with custom properties. Returns profile ID.
2. **Subscribe with consent** — `POST /api/profile-subscription-bulk-create-jobs/`. Async. Sets `email.marketing.consent: SUBSCRIBED` and adds to list. Triggers list-based flows.
3. **Direct list-add** — `POST /api/lists/{id}/relationships/profiles/`. Sync. Guarantees membership immediately even if (2) is delayed.

Why three calls: (1) sets the data, (2) sets consent + triggers welcome flow, (3) ensures membership lands fast. (2) alone has timing issues, (3) alone doesn't trigger flows.

`KLAVIYO_LIST_ID` has a hardcoded fallback (`'TbWzci'`) at the top of the file because the env var is currently wrong in Cloudflare. Once the env var is fixed, the fallback becomes a no-op and can be removed.

`_klaviyo_debug` field in the response surfaces: `profileStatus`, `subStatus`, `addStatus`, payloads, error bodies. Strip before going to truly clean production.

## Admin auth

`admin/_middleware.js` checks a session cookie set by `admin/login.js` after TOTP verification. Don't bypass for "convenience" — TOTP is the only thing between the public web and KV writes.

## Common patterns

- All handlers wrap in try/catch and call `captureException(context, err, { tags: { route: 'X' } })` from `lib/sentry.js` before returning a 500.
- Always return JSON with `Content-Type: application/json`.
- Validate required fields up front, return 400 with a clear `error` field.
- KV reads/writes go through `env.ADMIN_DATA.get(key)` / `put(key, value)`. Single big JSON blob under `billing_data` key — read, mutate, write back.
