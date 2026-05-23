# Stripe subscriptions — smoke test

End-to-end check that the recurring path works in test mode before flipping live keys. Test mode only — do not run against live Stripe.

## Prereqs

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` set in `/etc/wabash/env`.
- Stripe dashboard webhook endpoint at `https://admin.wabashsystems.com/stripe_webhook.php` subscribed to at least:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

## Steps

1. **Run the migration.**
   ```
   mysql wabash_crm < lamp/schema/migrations/010_stripe_subscriptions.sql
   ```
   Verify with `DESCRIBE wabash_crm.invoices;` that the four new columns landed and `SHOW TABLES LIKE 'stripe_subscriptions';` returns the new table.

2. **Create a recurring invoice.** Open `/invoice_new.php?lead_id=<your-own-lead>`. Pick **Recurring retainer**, set interval = Monthly / every 1, one line item at `$1.00`. Save.

3. **Send it.** From `/invoice_view.php?id=<new>`, click **Send**. The email subject should read "Subscription <number> from Wabash Systems"; the CTA should say "Subscribe — $1.00 per month".

4. **Subscribe as the client.** Open the email, click the CTA. Stripe Checkout opens in subscription mode (it will say "$1.00 / month" near the total). Pay with `4242 4242 4242 4242`, any future date, any CVC, any ZIP.

5. **Verify webhooks fired.**
   ```
   SELECT event_type, processed_at FROM stripe_events ORDER BY id DESC LIMIT 10;
   ```
   You should see `checkout.session.completed` and `customer.subscription.created` within a few seconds. `invoice.payment_succeeded` typically follows.

6. **Confirm the subscription row.**
   ```
   SELECT id, status, amount_cents, interval_unit, current_period_end FROM stripe_subscriptions ORDER BY created_at DESC LIMIT 1;
   ```
   Status should be `active`. `current_period_end` ~30 days out.

7. **Visit `/subscriptions.php`.** The row appears under the table with MRR = $1.00 and status badge `active`. Total MRR at the top reflects it.

8. **Test "Cancel at period end".** Click the action on that row. Confirm the modal. Stripe call returns 200; the page redirects with a green flash. The row's status stays `active` but now reads `cancel at period end` under the badge. Verify in Stripe dashboard that `cancel_at_period_end` is true on the subscription. The `customer.subscription.updated` webhook should fire and the `cancel_at_period_end` column in `stripe_subscriptions` flips to 1.

9. **(Optional) Test the failure path.** In the Stripe dashboard → Customers → your test customer, update the payment method to the failing test card `4000 0000 0000 0341`. Trigger a manual invoice from the subscription. `invoice.payment_failed` fires, and you should receive a "Subscription payment failed for ..." email at `andy.gray@wabashsystems.com`.

## Rollback

If the migration needs to be reversed:

```sql
ALTER TABLE invoices DROP COLUMN stripe_subscription_id;
ALTER TABLE invoices DROP COLUMN billing_type;
ALTER TABLE invoices DROP COLUMN recurring_interval;
ALTER TABLE invoices DROP COLUMN recurring_interval_count;
DROP TABLE stripe_subscriptions;
```

Existing one-time invoices in production are unaffected by the rollback — only new recurring rows reference the dropped columns.
