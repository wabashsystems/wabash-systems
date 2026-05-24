# Stripe subscriptions — smoke test

End-to-end check that the recurring (and one-time) payment path works in test
mode. Test mode only — the scripts refuse to run unless `STRIPE_SECRET_KEY`
starts with `sk_test_`.

## TL;DR — scripted path

From the workspace root in PowerShell:

```powershell
.\run-smoke-stripe.ps1 start                      # default: recurring monthly $1
.\run-smoke-stripe.ps1 start -Mode one_time       # one-time path
```

The `start` step prints a `lead_id`, `invoice_id`, and a **Stripe Checkout URL**.
Open the URL in a browser and pay with:

```
Card:  4242 4242 4242 4242
Exp:   any future date
CVC:   any 3 digits
ZIP:   any 5 digits
```

Then verify webhooks landed and DB state is correct:

```powershell
.\run-smoke-stripe.ps1 verify <invoice_id>
```

Each expected state prints `OK` or `FAIL`:

- Invoice status = `paid`
- Subscription status = `active` (recurring only)
- `checkout.session.completed` webhook received
- `customer.subscription.created` webhook received (recurring only)
- `invoice.payment_succeeded` webhook received (recurring only)

If `FAIL` shows, re-run `verify` after a few seconds — Stripe webhooks can take
5–10s to land. Anything still red after 30s means a real bug.

When done, clean up the test data:

```powershell
.\run-smoke-stripe.ps1 cleanup <invoice_id>
```

Cleanup cancels the Stripe subscription immediately, marks the invoice as `void`
in the DB, and deletes the test lead (if it has no other invoices and was
created with `source='smoke_test'`).

## Prereqs (one-time setup)

- Migration `010_stripe_subscriptions.sql` applied to `wabash_crm`. Verify with
  `DESCRIBE wabash_crm.invoices;` (expect `billing_type`, `recurring_interval`,
  `recurring_interval_count`, `stripe_subscription_id`) and
  `SHOW TABLES LIKE 'stripe_subscriptions';`.
- `/etc/wabash/env` contains:
  - `STRIPE_SECRET_KEY=sk_test_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...` (from the Stripe sandbox endpoint)
  - `RESEND_API_KEY=...`
- Stripe sandbox dashboard has a webhook endpoint at
  `https://admin.wabashsystems.com/stripe_webhook.php` subscribed to at least:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `charge.refunded`
  - `payment_intent.payment_failed`

## What the scripts do

The PowerShell wrapper `run-smoke-stripe.ps1` scps three bash scripts to `/tmp`
on the box and invokes them via ssh.

- **`lamp/bin/smoke_stripe.sh`** — creates a fresh lead (`source='smoke_test'`,
  unique timestamped email) + a $1 invoice (recurring monthly by default, or
  one-time with `--mode=one_time`). Then mints a Stripe Checkout Session using
  the same logic as `invoice_send.php` (subscription mode for recurring,
  payment mode for one-time) and persists `stripe_checkout_session_id` +
  `payment_url` on the invoice row. Prints the URL.
- **`lamp/bin/smoke_stripe_verify.sh <invoice_id>`** — read-only. Dumps the
  invoice row, all `stripe_events` for the session/subscription, and the
  `stripe_subscriptions` row. Then prints OK/FAIL for each expected state.
- **`lamp/bin/smoke_stripe_cleanup.sh <invoice_id>`** — calls
  `\Stripe\Subscription::cancel()` immediately, marks invoice `void`, and
  deletes the test lead (only if `source='smoke_test'` and no other invoices).

## Manual UI path (alternative, slower)

If you want to exercise the actual `invoice_new.php` + `invoice_send.php` UI
instead of the scripted path:

1. `/invoice_new.php?lead_id=<your-own-lead>`. Pick **Recurring retainer**,
   Monthly / every 1, one line item at `$1.00`. Save.
2. From `/invoice_view.php?id=<new>` click **Send**. Subject should read
   "Subscription &lt;number&gt; from Wabash Systems"; CTA should say
   "Subscribe — $1.00 per month".
3. Open the email, click the CTA, pay with `4242 4242 4242 4242`.
4. Verify the webhooks + DB rows manually:
   ```sql
   SELECT event_type, processed_at FROM stripe_events ORDER BY id DESC LIMIT 10;
   SELECT id, status, amount_cents, interval_unit, current_period_end
     FROM stripe_subscriptions ORDER BY created_at DESC LIMIT 1;
   ```
5. Visit `/subscriptions.php` — the row should appear with MRR = $1.00,
   status `active`, and the table MRR total should reflect it.
6. Click **Cancel at period end** on the row. Confirm modal. Status stays
   `active` but reads "cancel at period end". `customer.subscription.updated`
   fires and `cancel_at_period_end` flips to 1.
7. **(Optional) Failure path.** In Stripe → Customers → your test customer,
   swap the payment method to `4000 0000 0000 0341`, trigger a manual invoice
   from the subscription. `invoice.payment_failed` fires and an alert email
   lands at `andy.gray@wabashsystems.com`.

## Rollback

If the schema migration ever needs to be reversed:

```sql
ALTER TABLE invoices DROP COLUMN stripe_subscription_id;
ALTER TABLE invoices DROP COLUMN billing_type;
ALTER TABLE invoices DROP COLUMN recurring_interval;
ALTER TABLE invoices DROP COLUMN recurring_interval_count;
DROP TABLE stripe_subscriptions;
```

Existing one-time invoices are unaffected — only new recurring rows reference
the dropped columns.
