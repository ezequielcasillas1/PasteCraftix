# PasteCraft Website & Payment Integration - Deployment Guide

## 🚀 Quick Start

You have everything ready to go! Follow these steps to deploy your website and activate payments.

---

## Step 1: Deploy Website to Netlify

### Option A: Drag & Drop (Easiest)

1. Go to [Netlify](https://app.netlify.com/)
2. Click "Add new site" → "Deploy manually"
3. Drag the entire `website` folder into the drop zone
4. Wait for deployment (takes 30 seconds)
5. Netlify will give you a URL like `https://random-name.netlify.app`

### Option B: Connect Git Repository

1. Push this `website` folder to GitHub
2. Go to Netlify → "Add new site" → "Import an existing project"
3. Connect to GitHub
4. Select your repository
5. Build settings (also defined in repo-root `netlify.toml`):
   - **Base directory:** `website`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist` (Astro build output — not the repo root)
   - **Production branch:** `main` (feature branches do not update pastecraft.com)
6. Click "Deploy site"

> **Important:** Netlify builds from `website/src/` via Astro. Legacy files like `website/index.html` are not published when the Astro build runs.

### Configure Custom Domain

1. In Netlify, go to "Domain settings"
2. Click "Add custom domain"
3. Enter: `pastecraft.com`
4. Netlify will give you DNS instructions
5. Update your domain's nameservers or add DNS records

---

## Step 2: Deploy Supabase Edge Functions

### Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### Login to Supabase

```bash
supabase login
```

### Link to Your Project

```bash
supabase link --project-ref blpngeeqcegquiydreyu
```

### Deploy Edge Functions

```bash
# Deploy create-checkout function
supabase functions deploy create-checkout

# Deploy stripe-webhook function
supabase functions deploy stripe-webhook
```

### Set Environment Secrets

```bash
# Add your Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE

# Add Supabase URL
supabase secrets set SUPABASE_URL=https://blpngeeqcegquiydreyu.supabase.co

# Add Supabase service role key (get from Supabase dashboard > Settings > API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

---

## Step 3: Configure Stripe Webhook

### Get Webhook Endpoint URL

After deploying the `stripe-webhook` function, you'll have this URL:
```
https://blpngeeqcegquiydreyu.supabase.co/functions/v1/stripe-webhook
```

### Set Up Webhook in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter webhook URL: `https://blpngeeqcegquiydreyu.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen for:
   - ✓ `checkout.session.completed`
   - ✓ `customer.subscription.updated`
   - ✓ `customer.subscription.deleted`
   - ✓ `invoice.payment_failed`
5. Click "Add endpoint"
6. **Copy the "Signing secret"** (starts with `whsec_...`)

### Add Webhook Secret to Supabase

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

---

## Step 4: Test the Payment Flow

### Test Checkout

1. Go to `https://pastecraft.com/pricing.html` (or your Netlify URL)
2. Click "Get Started" on any plan
3. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
4. Complete checkout
5. You should be redirected to `success.html`

### Verify in Stripe Dashboard

1. Go to [Stripe Dashboard → Payments](https://dashboard.stripe.com/payments)
2. You should see the test payment

### Verify in Supabase

1. Go to Supabase Dashboard → Table Editor
2. Open `user_subscriptions` table
3. You should see a new record with:
   - `subscription_tier`: "premium"
   - `subscription_status`: "active"
   - `stripe_customer_id`: Filled
   - `stripe_subscription_id`: Filled

---

## Step 5: Update Extension to Check Subscription

The extension already has `getUserSubscription()` method. Now users who pay will automatically have premium access!

When users try premium features:
1. Extension checks `subscription_tier` from database
2. If "premium" → Allow feature
3. If "free" → Show upgrade modal → Open `https://pastecraft.com/pricing.html`

---

## 🎯 What's Live Now

✅ **Website:** Homepage + Pricing + Success pages  
✅ **Stripe Integration:** All 3 subscription tiers (Weekly/Monthly/Yearly)  
✅ **Checkout:** Secure Stripe Checkout flow  
✅ **Webhooks:** Automatic subscription updates in database  
✅ **Edge Functions:** Serverless backend for payments  

---

## 📝 Price IDs Reference

- **Weekly ($2.99):** `price_1SUYvZLOdeLTrjapm8MFzC7N`
- **Monthly ($6.99):** `price_1SUYs3LOdeLTrjapCFFDe7td`
- **Yearly ($59.99):** `price_1SUYuJLOdeLTrjap4OhQRi8C`

---

## 🔒 Security Checklist

- ✅ Stripe Secret Key stored in Supabase secrets (never in code)
- ✅ Webhook signature verification enabled
- ✅ CORS headers configured
- ✅ Using HTTPS everywhere
- ✅ Service role key for database writes (webhook only)

---

## 🆘 Troubleshooting

### Checkout button does nothing
- Check browser console for errors
- Verify Edge Function is deployed: `https://blpngeeqcegquiydreyu.supabase.co/functions/v1/create-checkout`
- Test with: `curl -X POST [URL] -H "Content-Type: application/json" -d '{"priceId":"price_1SUYs3LOdeLTrjapCFFDe7td"}'`

### Subscription not updating in database
- Check Stripe webhook logs in Stripe Dashboard
- Check Supabase Edge Function logs in Supabase Dashboard
- Verify webhook secret is correct

### Website not loading
- Check Netlify deploy logs
- Verify DNS settings

---

## 🎉 You're Done!

Your complete payment system is ready:
1. Users see pricing on website
2. Click "Get Started" → Stripe Checkout
3. Payment succeeds → Webhook updates database
4. Extension automatically grants premium access

**Support:** If you need help, email support@pastecraft.com




