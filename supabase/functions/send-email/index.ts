// send-email — Supabase Auth "Send Email" hook via Resend
// Configure: Authentication → Hooks → Send Email → this function URL (verify_jwt OFF)

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'PasteCraft <support@pastecraft.com>'
const HOOK_SECRET_RAW = Deno.env.get('SEND_EMAIL_HOOK_SECRET') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://pastecraft.com'

type EmailActionType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'
  | 'reauthentication'

type EmailData = {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: EmailActionType
  site_url: string
  token_new: string
  token_hash_new: string
}

type HookUser = {
  email: string
  new_email?: string
}

const SUBJECTS: Record<string, string> = {
  signup: 'Welcome to PasteCraft - Verify Your Email',
  recovery: 'Reset Your PasteCraft Password',
  magiclink: 'Your PasteCraft Login Link',
  email_change: 'Confirm Your New Email Address',
  invite: "You're Invited to PasteCraft",
  reauthentication: 'Your PasteCraft Verification Code',
}

function hookSecret(): string {
  return HOOK_SECRET_RAW.replace(/^v1,whsec_/, '')
}

function buildVerifyUrl(siteUrl: string, tokenHash: string, actionType: string, redirectTo: string): string {
  const base = siteUrl.replace(/\/$/, '')
  const params = new URLSearchParams({
    token: tokenHash,
    type: actionType,
    redirect_to: redirectTo || `${SITE_URL}/auth/callback`,
  })
  return `${base}/auth/v1/verify?${params.toString()}`
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function buildAuthEmailHtml(opts: {
  title: string
  subtitle: string
  headline: string
  body: string
  ctaLabel: string
  actionUrl: string
  siteUrl: string
  otp?: string
}): string {
  const otpBlock = opts.otp
    ? `<p style="margin:0 0 24px;color:rgba(243,249,251,0.78);font-size:15px;line-height:1.7;">Or enter this code: <strong style="color:#ebb441;letter-spacing:2px;">${esc(opts.otp)}</strong></p>`
    : ''

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#071523;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f3f9fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#071523;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0c1f31;border:1px solid rgba(162,207,212,0.16);border-radius:22px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#a2cfd4 0%,#3575a0 38%,#17547c 100%);padding:44px 32px;text-align:center;">
<h1 style="margin:0 0 4px;color:#fff;font-size:28px;font-weight:700;">PasteCraft</h1>
<p style="margin:0;color:rgba(243,249,251,0.82);font-size:14px;font-weight:500;letter-spacing:0.6px;text-transform:uppercase;">${esc(opts.subtitle)}</p>
</td></tr>
<tr><td style="padding:44px 40px;background:#0c1f31;">
<h2 style="margin:0 0 14px;color:#f3f9fb;font-size:22px;font-weight:700;">${esc(opts.headline)}</h2>
<p style="margin:0 0 28px;color:rgba(243,249,251,0.78);font-size:15px;line-height:1.7;">${opts.body}</p>
${otpBlock}
<table role="presentation" width="100%"><tr><td align="center" style="padding:4px 0 28px;">
<a href="${esc(opts.actionUrl)}" style="display:inline-block;background:linear-gradient(135deg,#ebb441 0%,#d99a1f 100%);color:#071523;padding:15px 38px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">${esc(opts.ctaLabel)}</a>
</td></tr></table>
<p style="margin:0 0 8px;color:rgba(223,240,243,0.58);font-size:13px;">Button not working? Paste this link:</p>
<p style="margin:0 0 24px;padding:12px 14px;background:rgba(23,84,124,0.22);border:1px solid rgba(162,207,212,0.16);border-radius:10px;word-break:break-all;font-size:12px;color:#a2cfd4;font-family:Consolas,Menlo,monospace;">${esc(opts.actionUrl)}</p>
</td></tr>
<tr><td style="padding:24px 40px 32px;text-align:center;">
<p style="margin:0 0 10px;color:rgba(243,249,251,0.72);font-size:13px;">Questions? <a href="mailto:support@pastecraft.com" style="color:#a2cfd4;text-decoration:none;font-weight:600;">support@pastecraft.com</a></p>
<p style="margin:0;color:rgba(223,240,243,0.42);font-size:11px;">&copy; 2026 PasteCraft</p>
</td></tr>
</table></td></tr></table></body></html>`
}

function emailContent(actionType: EmailActionType, user: HookUser, emailData: EmailData) {
  const siteUrl = emailData.site_url || SITE_URL

  if (actionType === 'signup') {
    const url = buildVerifyUrl(siteUrl, emailData.token_hash, 'signup', emailData.redirect_to)
    return {
      to: user.email,
      subject: SUBJECTS.signup,
      html: buildAuthEmailHtml({
        title: SUBJECTS.signup,
        subtitle: 'Verify Your Email',
        headline: "You're one click away.",
        body: 'Confirm your email to unlock smarter clipboard management — save, organize, and supercharge your clips with AI.',
        ctaLabel: 'Verify My Email',
        actionUrl: url,
        siteUrl,
        otp: emailData.token,
      }),
    }
  }

  if (actionType === 'recovery') {
    const url = buildVerifyUrl(siteUrl, emailData.token_hash, 'recovery', emailData.redirect_to)
    return {
      to: user.email,
      subject: SUBJECTS.recovery,
      html: buildAuthEmailHtml({
        title: SUBJECTS.recovery,
        subtitle: 'Password Reset',
        headline: "Let's get you back in.",
        body: 'We received a request to reset your password. Use the link below to choose a new one. This link expires in 1 hour.',
        ctaLabel: 'Reset Password',
        actionUrl: url,
        siteUrl,
        otp: emailData.token,
      }),
    }
  }

  if (actionType === 'magiclink') {
    const url = buildVerifyUrl(siteUrl, emailData.token_hash, 'magiclink', emailData.redirect_to)
    return {
      to: user.email,
      subject: SUBJECTS.magiclink,
      html: buildAuthEmailHtml({
        title: SUBJECTS.magiclink,
        subtitle: 'Sign In',
        headline: 'Your login link is ready.',
        body: 'Click below to sign in to PasteCraft. This link expires soon.',
        ctaLabel: 'Sign In to PasteCraft',
        actionUrl: url,
        siteUrl,
        otp: emailData.token,
      }),
    }
  }

  if (actionType === 'invite') {
    const url = buildVerifyUrl(siteUrl, emailData.token_hash, 'invite', emailData.redirect_to)
    return {
      to: user.email,
      subject: SUBJECTS.invite,
      html: buildAuthEmailHtml({
        title: SUBJECTS.invite,
        subtitle: 'Invitation',
        headline: "You've been invited.",
        body: 'Accept your invitation to create a PasteCraft account.',
        ctaLabel: 'Accept Invitation',
        actionUrl: url,
        siteUrl,
      }),
    }
  }

  if (actionType === 'email_change') {
    const hasSecureChange = Boolean(emailData.token_hash_new && emailData.token_new)
    if (hasSecureChange && user.new_email) {
      return {
        multi: [
          {
            to: user.email,
            subject: SUBJECTS.email_change,
            html: buildAuthEmailHtml({
              title: SUBJECTS.email_change,
              subtitle: 'Email Change',
              headline: 'Confirm from your current email.',
              body: 'Use this link from your current email address to approve the change.',
              ctaLabel: 'Confirm Current Email',
              actionUrl: buildVerifyUrl(siteUrl, emailData.token_hash_new, 'email_change', emailData.redirect_to),
              siteUrl,
              otp: emailData.token,
            }),
          },
          {
            to: user.new_email,
            subject: SUBJECTS.email_change,
            html: buildAuthEmailHtml({
              title: SUBJECTS.email_change,
              subtitle: 'Email Change',
              headline: 'Confirm your new email.',
              body: 'Use this link on your new email address to finish the change.',
              ctaLabel: 'Confirm New Email',
              actionUrl: buildVerifyUrl(siteUrl, emailData.token_hash, 'email_change', emailData.redirect_to),
              siteUrl,
              otp: emailData.token_new,
            }),
          },
        ],
      }
    }

    const target = user.new_email || user.email
    const url = buildVerifyUrl(siteUrl, emailData.token_hash, 'email_change', emailData.redirect_to)
    return {
      to: target,
      subject: SUBJECTS.email_change,
      html: buildAuthEmailHtml({
        title: SUBJECTS.email_change,
        subtitle: 'Email Change',
        headline: 'Confirm your new email.',
        body: 'Click below to confirm your new email address.',
        ctaLabel: 'Confirm New Email',
        actionUrl: url,
        siteUrl,
        otp: emailData.token,
      }),
    }
  }

  const url = buildVerifyUrl(siteUrl, emailData.token_hash, actionType, emailData.redirect_to)
  return {
    to: user.email,
    subject: SUBJECTS.reauthentication,
    html: buildAuthEmailHtml({
      title: SUBJECTS.reauthentication,
      subtitle: 'Verification',
      headline: 'Your verification code',
      body: 'Use the button or code below to continue.',
      ctaLabel: 'Continue',
      actionUrl: url,
      siteUrl,
      otp: emailData.token,
    }),
  }
}

async function resendSend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend failed (${res.status}): ${detail}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  if (!RESEND_API_KEY) {
    return json({ error: 'RESEND_API_KEY not configured' }, 500)
  }

  if (!HOOK_SECRET_RAW) {
    return json({ error: 'SEND_EMAIL_HOOK_SECRET not configured' }, 500)
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  try {
    const wh = new Webhook(hookSecret())
    const { user, email_data } = wh.verify(payload, headers) as {
      user: HookUser
      email_data: EmailData
    }

    const content = emailContent(email_data.email_action_type, user, email_data)

    if ('multi' in content && content.multi) {
      for (const item of content.multi) {
        await resendSend(item.to, item.subject, item.html)
      }
    } else if ('to' in content && content.to && content.subject && content.html) {
      await resendSend(content.to, content.subject, content.html)
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[send-email]', error)
    const message = error instanceof Error ? error.message : 'send-email failed'
    return json({ error: { message } }, 401)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
