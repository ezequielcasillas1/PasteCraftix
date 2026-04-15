# PasteCraft Resend Email Integration

**Purpose:** Configure Resend as the email provider for Supabase Auth emails  
**Branch:** PC1.7

---

## Overview

There are **two approaches** for Resend integration with Supabase:

| Approach | Complexity | Customization | Best For |
|----------|------------|---------------|----------|
| **SMTP Integration** | Simple | Templates via Dashboard | Quick setup, standard auth emails |
| **Send Email Hook** | Advanced | Full React Email control | Custom designs, transactional emails |

**Recommendation:** Start with SMTP Integration for auth emails, add Hook for transactional emails later.

---

## Option 1: SMTP Integration (Recommended First)

### Prerequisites
1. Create Resend account at https://resend.com
2. Verify your domain (`pastecraft.com`)
3. Generate an API key

### Resend SMTP Credentials

| Setting | Value |
|---------|-------|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (TLS) |
| Username | `resend` |
| Password | `[YOUR_RESEND_API_KEY]` |

### Configuration Steps

**Step 1: Get Resend API Key**
1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name: `PasteCraft Supabase SMTP`
4. Permission: `Full access` (for SMTP)
5. Copy the key (starts with `re_`)

**Step 2: Verify Domain in Resend**
1. Go to https://resend.com/domains
2. Add domain: `pastecraft.com`
3. Add the DNS records Resend provides
4. Wait for verification (usually minutes)

**Step 3: Configure Supabase SMTP**
1. Go to Supabase Dashboard → **Authentication** → **SMTP Settings**
2. Enable "Use Custom SMTP"
3. Enter:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `[YOUR_RESEND_API_KEY]`
   - Sender email: `support@pastecraft.com`
   - Sender name: `PasteCraft`
4. Save

**Step 4: Deploy Email Templates**
1. Go to **Authentication** → **Email Templates**
2. For each template, paste HTML from `supabase/templates/*.html`
3. Set subject lines per the template README

### Verification Test

After configuration:
1. Create a new test account in PasteCraft
2. Check email delivery in Resend dashboard (https://resend.com/emails)
3. Verify email renders correctly
4. Test password reset flow
5. Test magic link (if enabled)

---

## Option 2: Send Email Hook (Advanced)

For fully custom emails with React Email components.

### When to Use
- Need dynamic email content beyond Go templates
- Want to use React Email for complex designs
- Need to send transactional emails (welcome, subscription, etc.)

### Implementation Steps

**Step 1: Add Resend Secret to Supabase**

```bash
# Via Supabase CLI
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
```

Or via Dashboard: **Project Settings** → **Edge Functions** → **Secrets**

**Step 2: Create Send Email Edge Function**

Create `supabase/functions/send-email/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, template } = await req.json()

    const { data, error } = await resend.emails.send({
      from: 'PasteCraft <support@pastecraft.com>',
      to: [to],
      subject,
      html,
    })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 3: Deploy Function**

```bash
supabase functions deploy send-email
```

**Step 4: Configure Auth Hook (Optional)**

For auth emails via Edge Function instead of SMTP:
1. Go to **Authentication** → **Hooks**
2. Create "Send Email" hook
3. Point to your `send-email` function URL
4. Add webhook secret

---

## Email Types & Implementation Matrix

| Email Type | Method | Trigger |
|------------|--------|---------|
| Signup Confirmation | SMTP (templates) | Auto on signup |
| Password Reset | SMTP (templates) | Auto on request |
| Magic Link | SMTP (templates) | Auto on request |
| Email Change | SMTP (templates) | Auto on request |
| Welcome Email | Edge Function | After email confirmed |
| Subscription Confirmed | Edge Function | Stripe webhook |
| Payment Failed | Edge Function | Stripe webhook |
| Support Reply | Manual / Mailbox | Customer service |

---

## Next Steps Checklist

### Phase 1: Basic Auth Emails (SMTP)
- [ ] Create Resend account
- [ ] Verify `pastecraft.com` domain in Resend
- [ ] Generate Resend API key
- [ ] Configure SMTP in Supabase Dashboard
- [ ] Deploy HTML templates to Email Templates
- [ ] Test signup → confirmation email
- [ ] Test password reset → recovery email
- [ ] Test email change → confirmation email

### Phase 2: Transactional Emails (Edge Function)
- [ ] Add `RESEND_API_KEY` to Supabase secrets
- [ ] Create `send-email` Edge Function
- [ ] Deploy function
- [ ] Add welcome email trigger (on user confirmed)
- [ ] Add subscription confirmation (in stripe-webhook)

### Phase 3: Advanced Features
- [ ] Implement Auth Hook for custom auth emails
- [ ] Add email tracking/analytics
- [ ] Create email preference center
- [ ] Implement unsubscribe handling

---

## Resend Pricing

| Plan | Emails/Month | Price |
|------|--------------|-------|
| Free | 3,000 | $0 |
| Pro | 50,000 | $20/mo |
| Business | 100,000+ | Custom |

Free tier is sufficient for launch. Upgrade as user base grows.

---

## Security Notes

1. **Never expose Resend API key in extension code**
2. Store key only in Supabase secrets (Edge Functions)
3. Use SMTP integration for auth (handled by Supabase server-side)
4. Rate limit transactional emails to prevent abuse

---

## Troubleshooting

**Emails not sending:**
- Check Resend dashboard for delivery status
- Verify domain is confirmed
- Check Supabase logs for SMTP errors

**Emails going to spam:**
- Ensure SPF/DKIM/DMARC records are set
- Use consistent sender address
- Avoid spam trigger words in subject/body

**Template variables not working:**
- Use Go template syntax: `{{ .ConfirmationURL }}`
- Check Supabase docs for available variables
