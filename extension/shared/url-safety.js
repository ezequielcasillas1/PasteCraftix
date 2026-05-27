/**

 * URL safety checks for opening links and page injection guard.

 *

 * Open-path unit-style examples (isUrlSafeToOpen):

 *   blocked: javascript:alert(1)              → code blocked_javascript

 *   blocked: data:text/html,<script>alert(1) → code blocked_data

 *   blocked: vbscript:msgbox(1)             → code blocked_vbscript

 *   blocked: file:///etc/passwd             → code blocked_file

 *   blocked: blob:https://x/uuid            → code blocked_blob

 *   blocked: javascript&#58;alert(1)        → code blocked_javascript (entity decode)

 *   allowed: https://example.com/path       → allowed true

 *   blocked: not-a-url                      → code invalid_url (fail closed)

 */



export const BLOCKED_PROTOCOLS =

  /^(chrome|chrome-extension|edge|about|devtools|view-source|file|blob|data|javascript|vbscript):/i;



const OPEN_PROTOCOLS = /^https?:$/i;



/** Explicit dangerous schemes for scan-before-open (http(s) only). */

const DANGEROUS_OPEN_PROTOCOLS = [

  { re: /^javascript:/i, code: 'blocked_javascript' },

  { re: /^data:/i, code: 'blocked_data' },

  { re: /^vbscript:/i, code: 'blocked_vbscript' },

  { re: /^file:/i, code: 'blocked_file' },

  { re: /^blob:/i, code: 'blocked_blob' },

];



export const SENSITIVE_FINANCE_HOSTS = new Set([

  'paypal.com', 'www.paypal.com', 'chase.com', 'www.chase.com',

  'bankofamerica.com', 'www.bankofamerica.com', 'wellsfargo.com', 'www.wellsfargo.com',

  'citi.com', 'www.citi.com', 'capitalone.com', 'www.capitalone.com',

  'americanexpress.com', 'www.americanexpress.com', 'discover.com', 'www.discover.com',

  'usbank.com', 'www.usbank.com', 'pnc.com', 'www.pnc.com', 'stripe.com', 'checkout.stripe.com',

]);



export const SCAM_PATH_KEYWORDS = [

  'wallet-connect', 'walletconnect', 'metamask-verify', 'seed-phrase', 'recovery-phrase',

  'airdrop-claim', 'crypto-giveaway', 'login-verify', 'account-suspended',

];



/** Bundled known-malicious / phishing hosts (merged with remote blocklist when cached). */

export const BLOCKED_HOSTS = new Set([

  'metamask-wallet.io', 'metamaskweb.com', 'walletconnect-verification.com',

  'secure-paypal-login.com', 'paypal-security-check.com', 'appleid-verify.com',

  'microsoft-account-alert.com', 'chase-online-verify.com', 'bankofamerica-secure-login.com',

]);



/**
 * High-abuse free / scam-only TLDs. Removed: .work, .support, .ru, .xyz, .top,
 * .click, .rest, .cam — these have massive legitimate use (yandex.ru, web3 .xyz,
 * AI tools on .top, business sites on .work/.support). Re-blocking them here
 * caused the widget to disappear on huge swaths of legit sites.
 */
export const SCAM_TLD_RE =

  /\.(zip|mov|bond|cfd|sbs|gq|tk|ml|ga|cf)$/i;

/**
 * High-traffic / critical-flow hosts that must never be blocked regardless of
 * remote blocklist contents, suffix matches, or TLD heuristics. Last line of
 * defense against a poisoned upstream feed nuking the widget on safe sites.
 */
export const SAFE_ALLOWLIST_HOSTS = new Set([
  'google.com', 'www.google.com', 'mail.google.com', 'drive.google.com', 'docs.google.com',
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'github.com', 'www.github.com', 'gist.github.com', 'raw.githubusercontent.com',
  'githubusercontent.com',
  'microsoft.com', 'www.microsoft.com', 'login.microsoftonline.com', 'office.com',
  'apple.com', 'www.apple.com', 'icloud.com',
  'amazon.com', 'www.amazon.com',
  'wikipedia.org', 'en.wikipedia.org',
  'stackoverflow.com', 'stackexchange.com',
  'reddit.com', 'www.reddit.com', 'old.reddit.com',
  'x.com', 'twitter.com', 'www.twitter.com',
  'facebook.com', 'www.facebook.com', 'm.facebook.com',
  'linkedin.com', 'www.linkedin.com',
  'cursor.com', 'www.cursor.com',
  'openai.com', 'chat.openai.com', 'chatgpt.com',
  'anthropic.com', 'claude.ai',
  'pastecraft.com', 'www.pastecraft.com',
  'supabase.com', 'www.supabase.com',
  'netlify.com', 'www.netlify.com',
  'vercel.com', 'www.vercel.com',
  'cloudflare.com', 'www.cloudflare.com',
  'localhost',
]);

function isAllowlisted(host) {
  if (!host) return false;
  if (SAFE_ALLOWLIST_HOSTS.has(host)) return true;
  for (const safe of SAFE_ALLOWLIST_HOSTS) {
    if (host === safe || host.endsWith('.' + safe)) return true;
  }
  return false;
}



let runtimeBlockedHosts = null;



export function setRuntimeBlockedHosts(hosts) {

  if (!hosts || !(hosts instanceof Set)) {

    runtimeBlockedHosts = null;

    return;

  }

  runtimeBlockedHosts = hosts;

}



function getBlockedHostsSet() {

  if (runtimeBlockedHosts && runtimeBlockedHosts.size) {

    const merged = new Set(BLOCKED_HOSTS);

    for (const h of runtimeBlockedHosts) merged.add(h);

    return merged;

  }

  return BLOCKED_HOSTS;

}



function decodeHtmlEntities(str) {

  return String(str ?? '')

    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {

      const cp = parseInt(hex, 16);

      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';

    })

    .replace(/&#(\d+);/g, (_, num) => {

      const cp = parseInt(num, 10);

      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';

    })

    .replace(/&colon;/gi, ':')

    .replace(/&sol;/gi, '/');

}



/** Trim, strip leading control chars, decode common obfuscation (e.g. javascript&#58;). */

export function normalizeUrlInput(rawUrl) {

  let url = String(rawUrl ?? '')

    .replace(/^\uFEFF/, '')

    .replace(/^[\u0000-\u001F\u007F]+/, '')

    .trim();

  url = decodeHtmlEntities(url);

  url = decodeHtmlEntities(url);

  return url.trim();

}



function hostnameFromUrl(rawUrl) {

  try {

    return new URL(String(rawUrl || '')).hostname.toLowerCase();

  } catch (_) {

    return '';

  }

}



function isPunycodeHomoglyph(host) {

  return host.includes('xn--');

}



function hostMatchesSet(host, set) {

  if (!host) return false;

  if (set.has(host)) return true;

  for (const blocked of set) {

    if (host === blocked || host.endsWith('.' + blocked)) return true;

  }

  return false;

}



function pathLooksScammy(rawUrl) {

  try {

    const u = new URL(String(rawUrl || ''));

    const hay = `${u.pathname}${u.search}`.toLowerCase();

    return SCAM_PATH_KEYWORDS.some((kw) => hay.includes(kw));

  } catch (_) {

    return false;

  }

}



function blockedProtocolResult(code, url, httpOnly) {

  const host = hostnameFromUrl(url);

  const reasonCode = httpOnly && code.startsWith('blocked_') ? code : 'unsafe_protocol';

  return {

    allowed: false,

    reason: userReason(reasonCode),

    code: reasonCode,

    domain: host,

    host,

  };

}



function userReason(code) {

  const map = {

    blocked_javascript: 'javascript: links cannot be opened from PasteCraft.',

    blocked_data: 'data: links cannot be opened from PasteCraft.',

    blocked_vbscript: 'vbscript: links cannot be opened from PasteCraft.',

    blocked_file: 'file: links cannot be opened from PasteCraft.',

    blocked_blob: 'blob: links cannot be opened from PasteCraft.',

    unsafe_protocol: 'This link uses an unsafe protocol and cannot be opened.',

    not_http: 'Only http:// and https:// links can be opened from PasteCraft.',

    invalid_url: 'This URL could not be parsed.',

    blocked_host: 'This domain is on PasteCraft\'s phishing blocklist.',

    sensitive_finance: 'Opening banking or payment sites from saved clips is blocked for your safety.',

    punycode: 'This link may be a homograph phishing attempt (unusual punycode domain).',

    scam_tld: 'This top-level domain is commonly used in scams.',

    scam_path: 'This URL path matches known phishing patterns.',

  };

  return map[code] || 'This link was blocked for your safety.';

}



function matchDangerousOpenProtocol(url) {

  for (const { re, code } of DANGEROUS_OPEN_PROTOCOLS) {

    if (re.test(url)) return code;

  }

  return null;

}



function evaluateUrl(rawUrl, { httpOnly = false } = {}) {

  const url = normalizeUrlInput(rawUrl);

  if (!url) {

    return { allowed: false, reason: userReason('invalid_url'), code: 'invalid_url', domain: '', host: '' };

  }



  if (httpOnly) {

    const dangerousCode = matchDangerousOpenProtocol(url);

    if (dangerousCode) {

      return blockedProtocolResult(dangerousCode, url, httpOnly);

    }

  }



  if (BLOCKED_PROTOCOLS.test(url)) {

    if (httpOnly) {

      const fallbackCode = matchDangerousOpenProtocol(url) || 'unsafe_protocol';

      return blockedProtocolResult(fallbackCode, url, httpOnly);

    }

    const host = hostnameFromUrl(url);

    return {

      allowed: false,

      reason: userReason('unsafe_protocol'),

      code: 'unsafe_protocol',

      domain: host,

      host,

    };

  }



  let parsed;

  try {

    parsed = new URL(url);

  } catch (_) {

    return { allowed: false, reason: userReason('invalid_url'), code: 'invalid_url', domain: '', host: '' };

  }



  if (httpOnly && !OPEN_PROTOCOLS.test(parsed.protocol)) {

    const host = parsed.hostname.toLowerCase();

    return {

      allowed: false,

      reason: userReason('not_http'),

      code: 'not_http',

      domain: host,

      host,

    };

  }



  const host = parsed.hostname.toLowerCase();

  if (!host) {

    return { allowed: false, reason: userReason('invalid_url'), code: 'invalid_url', domain: '', host: '' };

  }



  const blockedHosts = getBlockedHostsSet();

  if (isAllowlisted(host)) {
    return { allowed: true, domain: host, host, normalizedUrl: parsed.href };
  }



  if (hostMatchesSet(host, SENSITIVE_FINANCE_HOSTS)) {

    return { allowed: false, reason: userReason('sensitive_finance'), code: 'sensitive_finance', domain: host, host };

  }

  if (hostMatchesSet(host, blockedHosts)) {

    return { allowed: false, reason: userReason('blocked_host'), code: 'blocked_host', domain: host, host };

  }

  if (isPunycodeHomoglyph(host)) {

    return { allowed: false, reason: userReason('punycode'), code: 'punycode', domain: host, host };

  }

  if (SCAM_TLD_RE.test(host)) {

    return { allowed: false, reason: userReason('scam_tld'), code: 'scam_tld', domain: host, host };

  }

  if (pathLooksScammy(url)) {

    return { allowed: false, reason: userReason('scam_path'), code: 'scam_path', domain: host, host };

  }



  return { allowed: true, domain: host, host, normalizedUrl: parsed.href };

}



/** Page injection guard (widget / quick-paste) — same host rules, broader protocol block. */

export function isSiteAllowed(rawUrl = location.href) {

  return evaluateUrl(rawUrl, { httpOnly: false }).allowed;

}



/** Scan-before-open for user-initiated navigation — http(s) only, fail closed on parse errors. */

export function isUrlSafeToOpen(rawUrl) {

  return evaluateUrl(rawUrl, { httpOnly: true });

}


