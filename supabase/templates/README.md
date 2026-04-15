# PasteCraft Email Templates

Professional HTML email templates for Supabase Auth, support tickets, and transactional emails.

## Template Files

### Supabase Auth Templates (Deploy to Dashboard)

| File | Purpose | Supabase Dashboard Location |
|------|---------|---------------------------|
| `confirmation.html` | Email verification on signup | Email Templates → Confirm Signup |
| `magic-link.html` | Passwordless login link | Email Templates → Magic Link |
| `recovery.html` | Password reset | Email Templates → Reset Password |
| `email-change.html` | Confirm new email address | Email Templates → Change Email Address |
| `invite.html` | Admin/team invitations | Email Templates → Invite User |

### Security Notifications (Enable in Dashboard)

| File | Purpose | Supabase Dashboard Location |
|------|---------|---------------------------|
| `password-changed.html` | Alert when password is updated | Email Templates → Password Changed |

### Transactional Templates (Custom Implementation)

| File | Purpose | Implementation |
|------|---------|---------------|
| `welcome.html` | Post-signup onboarding | Edge Function or manual |
| `subscription-confirmed.html` | Payment confirmation | Stripe webhook trigger |
| `support-reply.html` | Customer support responses | Manual via mailbox |

### Support Ticket Confirmations (User receives)

| File | Category | Header Color |
|------|----------|--------------|
| `support-confirmation.html` | General support | Purple (brand) |
| `help-request-confirmation.html` | Help requests | Blue |
| `bug-report-confirmation.html` | Bug reports | Red |
| `feedback-confirmation.html` | Improvement suggestions | Green |

### Internal Team Notifications

| File | Purpose |
|------|---------|
| `internal-ticket-notification.html` | Dark-themed ticket alert for team inboxes |

### Email Destinations (Netlify Function)

| Type | Destination Email | Template |
|------|-------------------|----------|
| `support` | support@pastecraft.com | support-confirmation.html |
| `help` | help@pastecraft.com | help-request-confirmation.html |
| `reportbugs` | reportbugs@pastecraft.com | bug-report-confirmation.html |
| `howcanweimprove` | howcanweimprove@pastecraft.com | feedback-confirmation.html |
| `team` | team@pastecraft.com | support-confirmation.html |

## Deployment Instructions

### Step 1: Configure Custom SMTP

1. Go to **Supabase Dashboard** → **Project Settings** → **Authentication**
2. Under **SMTP Settings**, enter your Namecheap mailbox credentials:
   - Host: `mail.privateemail.com`
   - Port: `587` (TLS) or `465` (SSL)
   - Username: `support@pastecraft.com`
   - Password: [Your mailbox password]
   - Sender email: `support@pastecraft.com`
   - Sender name: `PasteCraft`

### Step 2: Deploy Auth Templates

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates**
2. For each template:
   - Select the template type (Confirm Signup, Magic Link, etc.)
   - Copy the HTML content from the corresponding `.html` file
   - Paste into the "Body" field (HTML mode)
   - Set the Subject line as shown below
   - Save

**Subject Lines:**

| Template | Subject |
|----------|---------|
| Confirm Signup | Welcome to PasteCraft - Verify Your Email |
| Magic Link | Your PasteCraft Login Link |
| Reset Password | Reset Your PasteCraft Password |
| Change Email | Confirm Your New Email Address |
| Invite User | You're Invited to PasteCraft |
| Password Changed | Security Alert: Your Password Was Changed |

### Step 3: Enable Security Notifications

1. Go to **Authentication** → **Email Templates**
2. Enable notifications for:
   - ✅ Password changed
   - ✅ Email changed (optional)

## Template Variables

These variables are available in Supabase templates:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | Link to confirm the action |
| `{{ .Token }}` | OTP code (6-digit) |
| `{{ .TokenHash }}` | Server-side verification hash |
| `{{ .SiteURL }}` | Your site URL (pastecraft.com) |
| `{{ .Email }}` | User's email address |
| `{{ .NewEmail }}` | New email (for email change) |
| `{{ .OldEmail }}` | Old email (for email change) |

## Testing

1. Create a test account with a real email
2. Verify all auth flows:
   - Sign up → check confirmation email
   - Forgot password → check recovery email
   - Change email → check confirmation email
3. Check rendering in multiple email clients (Gmail, Outlook, Apple Mail)

## Design System

**Brand Colors:**
- Primary gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Text: `#2d3748` (dark), `#4a5568` (body), `#718096` (muted)
- Background: `#f5f7fa` (outer), `#ffffff` (card)
- Accent: `#ebb441`
- Success: `#68d391`
- Error: `#fc8181`

**Typography:**
- Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Headings: 700 weight
- Body: 16px, line-height 1.7

**Layout:**
- Max width: 600px
- Border radius: 16px (container), 8-12px (elements)
- Padding: 40px (main content)
