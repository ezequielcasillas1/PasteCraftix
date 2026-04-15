# PC 1.7 - Production Readiness Overview

**Branch:** PC1.7  
**Target:** Chrome Web Store + Edge Add-ons Store  
**Date:** April 15, 2026

---

## Current Status Summary

PasteCraft is approaching production readiness. This document outlines remaining tasks before store submission.

---

## Completed (MVP Foundation)

- Extension core functionality (clips, categories, notes, search)
- Supabase Auth integration (sign up, sign in, password reset)
- Stripe payment integration (checkout, webhooks, portal)
- AI features (summary, breakdown, image, vision, categorize, name)
- Cross-device sync architecture
- Website (landing, pricing, account, contact, terms, privacy)
- RLS policies and security hardening
- Admin API with auto-ban system

---

## Remaining for Production Release

### 1. Email Setup (BLOCKED - Waiting on Namecheap Mailbox)

**Dependency:** Namecheap Private Email service activation

**Required Steps:**
1. Activate Namecheap mailbox for `support@pastecraft.com` (or similar)
2. Configure custom SMTP in Supabase Dashboard
3. Design and deploy branded email templates

---

### 2. Supabase Auth Email Templates

**Location:** Supabase Dashboard → Authentication → Email Templates  
**Alternative:** Use Management API with PATCH request

**Templates Required:**

| Template | Purpose | Subject Line |
|----------|---------|--------------|
| Confirmation | Email verification on signup | Welcome to PasteCraft - Verify Your Email |
| Magic Link | Passwordless login | Your PasteCraft Login Link |
| Recovery | Password reset | Reset Your PasteCraft Password |
| Email Change | Confirm new email address | Confirm Your New Email Address |
| Invite | Team/admin invitations | You're Invited to PasteCraft |

**Design Requirements:**
- PasteCraft logo header
- Brand gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Brand colors: `#3575a0` (brand), `#a2cfd4` (soft), `#ebb441` (accent)
- Font: System fonts (Segoe UI, Roboto, San Francisco)
- Mobile responsive (600px max-width)
- Clear CTA buttons with brand styling
- Footer with support contact and unsubscribe

**Template Variables Available:**
- `{{ .ConfirmationURL }}` - Link to confirm action
- `{{ .Token }}` - OTP code (6-digit)
- `{{ .TokenHash }}` - Server-side verification
- `{{ .SiteURL }}` - pastecraft.com
- `{{ .Email }}` - User's email
- `{{ .NewEmail }}` / `{{ .OldEmail }}` - For email change

---

### 3. Security Notification Emails (Optional but Recommended)

**Enable in Supabase Dashboard → Authentication → Email Templates**

| Notification | Purpose |
|--------------|---------|
| Password Changed | Alert when password is updated |
| Email Changed | Alert when email is updated |
| MFA Enrolled | Alert when 2FA is enabled |
| MFA Removed | Alert when 2FA is disabled |

---

### 4. Transactional/Marketing Emails (Custom)

**Sender:** support@pastecraft.com (via Namecheap mailbox)

| Email Type | Trigger | Purpose |
|------------|---------|---------|
| Welcome Email | After email confirmation | Onboarding tips, getting started guide |
| Subscription Confirmed | After successful payment | Receipt + feature unlock confirmation |
| Subscription Canceled | After cancellation | Feedback request + win-back offer |
| Payment Failed | Failed charge | Update payment method reminder |
| Trial Ending | X days before trial ends | Upgrade prompt |
| Customer Support Reply | Manual from support team | Branded reply template |

**Implementation Options:**
1. **Edge Functions** - Create `send-email` Edge Function using Resend/SendGrid
2. **Manual via Mailbox** - Use Namecheap webmail with pre-designed templates
3. **Supabase Database Webhooks** - Trigger emails on specific DB events

---

### 5. Store Submission Checklist

**Chrome Web Store:**
- [ ] Privacy policy URL (pastecraft.com/privacy)
- [ ] Screenshots (1280x800 or 640x400)
- [ ] Promotional images (440x280, 920x680, 1400x560)
- [ ] Detailed description
- [ ] Category selection
- [ ] $5 developer registration fee

**Edge Add-ons Store:**
- [ ] Microsoft Partner Center account
- [ ] Privacy policy URL
- [ ] Screenshots and promotional images
- [ ] Compliance with Edge extension policies

---

## Email Template Design Spec

### Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  
  <!-- Container -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); padding:32px; text-align:center; border-radius:12px 12px 0 0;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:700;">📋 PasteCraft</h1>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td style="padding:40px 32px;">
              <!-- Dynamic content here -->
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; background:#f9fafb; border-radius:0 0 12px 12px; text-align:center;">
              <p style="margin:0 0 8px; color:#6b7280; font-size:14px;">
                Need help? Contact us at support@pastecraft.com
              </p>
              <p style="margin:0; color:#9ca3af; font-size:12px;">
                © 2026 PasteCraft. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
  
</body>
</html>
```

### CTA Button Style

```html
<a href="{{ .ConfirmationURL }}" style="display:inline-block; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:600; font-size:16px;">
  Verify Email
</a>
```

---

## Action Items

### Immediate (Before Store Submission)
1. [ ] Activate Namecheap mailbox
2. [ ] Configure custom SMTP in Supabase
3. [ ] Design 5 auth email templates
4. [ ] Upload templates to Supabase Dashboard
5. [ ] Test all auth flows end-to-end
6. [ ] Prepare store assets (screenshots, descriptions)

### Post-Launch
- [ ] Set up transactional email system (Edge Function + Resend)
- [ ] Create welcome email sequence
- [ ] Implement payment notification emails
- [ ] Customer support email templates

---

## Next Steps

1. **Namecheap Mailbox** - Waiting on Ezequiel to activate
2. **Email Templates** - Create HTML templates (can start now, deploy after SMTP ready)
3. **Store Assets** - Screenshot capture + promotional graphics
4. **Final Testing** - Full auth + payment flow validation

---

*PC 1.7 represents the first production-ready release for public stores.*
