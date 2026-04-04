# Stripe Sandbox Setup Guide

## 1. Access Stripe Dashboard

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Toggle **"Test mode"** (top-right switch) - should show orange "TEST" badge
3. All sandbox/test operations happen in this mode

---

## 2. Get Your Test API Keys

**Dashboard → Developers → API Keys**

Copy these keys (they start with `sk_test_` and `pk_test_`):
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
```

---

## 3. Create Test Products & Prices

**Dashboard → Products → Add Product**

### Basic Tier
- Name: `Basic Plan`
- Prices (recurring):
  - Weekly: $0.99/week
  - Monthly: $1.99/month
  - Yearly: $9.99/year

### Premium Tier
- Name: `Premium Plan`
- Prices (recurring):
  - Weekly: $1.99/week
  - Monthly: $4.99/month
  - Yearly: $49.99/year

**Copy each Price ID** (format: `price_xxxxx`) and update in:
`supabase/functions/stripe-webhook/index.ts`

---

## 4. Configure Webhook (Test Mode)

**Dashboard → Developers → Webhooks → Add endpoint**

```
Endpoint URL: https://<your-project>.supabase.co/functions/v1/stripe-webhook
```

**Events to listen for:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

**Copy webhook signing secret** (starts with `whsec_`):
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

---

## 5. Set Supabase Secrets

Run in terminal:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

Or set in Supabase Dashboard:
**Project → Edge Functions → Manage Secrets**

---

## 6. Test Cards

| Card Number         | Scenario                    |
|--------------------|-----------------------------|
| 4242 4242 4242 4242| Success                     |
| 4000 0000 0000 3220| 3D Secure required          |
| 4000 0000 0000 9995| Insufficient funds          |
| 4000 0000 0000 0002| Card declined               |

**Any future date** for expiry, **any 3 digits** for CVC, **any ZIP**.

---

## 7. Test Webhook Locally (Optional)

Install Stripe CLI:
```bash
# Windows (Scoop)
scoop install stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

Forward webhooks to local:
```bash
stripe login
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Use the webhook secret from CLI output for local testing.

---

## 8. Verify Integration

1. Open your pricing page
2. Click subscribe → use test card `4242 4242 4242 4242`
3. Complete checkout
4. Check Supabase `user_subscriptions` table for updated tier/status
5. Check Stripe Dashboard → Customers for new customer

---

## Quick Reference

| Item | Test Mode Value |
|------|-----------------|
| Secret Key | `sk_test_...` |
| Publishable Key | `pk_test_...` |
| Webhook Secret | `whsec_...` |
| Test Card | `4242 4242 4242 4242` |

---

## Your Current Price IDs

Already configured in `stripe-webhook/index.ts`:

**Basic:**
- Weekly: `price_1SsbbHLOdeLTrjapgaZzEbBt`
- Monthly: `price_1SsbTZLOdeLTrjap9UnXhu0M`
- Yearly: `price_1SsbBDLOdeLTrjapHTq7yxng`

**Premium:**
- Weekly: `price_1SaMM0LOdeLTrjapKLTHBByC`
- Monthly: `price_1SUYs3LOdeLTrjapCFFDe7td`
- Yearly: `price_1SaMNJLOdeLTrjapjJ8iCoP7`

**Note:** If these don't match your test products, update the webhook file.
