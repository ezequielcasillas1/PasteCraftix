/**
 * Runtime site guard — blocks widget/quick-paste on dangerous or sensitive pages.
 */

const BLOCKED_PROTOCOLS = /^(chrome|chrome-extension|edge|about|devtools|view-source|file|blob|data|javascript):/i;

const SENSITIVE_FINANCE_HOSTS = new Set([
  'paypal.com', 'www.paypal.com', 'chase.com', 'www.chase.com',
  'bankofamerica.com', 'www.bankofamerica.com', 'wellsfargo.com', 'www.wellsfargo.com',
  'citi.com', 'www.citi.com', 'capitalone.com', 'www.capitalone.com',
  'americanexpress.com', 'www.americanexpress.com', 'discover.com', 'www.discover.com',
  'usbank.com', 'www.usbank.com', 'pnc.com', 'www.pnc.com', 'stripe.com', 'checkout.stripe.com',
]);

const SCAM_PATH_KEYWORDS = [
  'wallet-connect', 'walletconnect', 'metamask-verify', 'seed-phrase', 'recovery-phrase',
  'airdrop-claim', 'crypto-giveaway', 'login-verify', 'account-suspended',
];

/** Subset of known-malicious / phishing host patterns (expand via pastecraft.com blocklist JSON). */
const BLOCKED_HOSTS = new Set([
  'metamask-wallet.io', 'metamaskweb.com', 'walletconnect-verification.com',
  'secure-paypal-login.com', 'paypal-security-check.com', 'appleid-verify.com',
  'microsoft-account-alert.com', 'chase-online-verify.com', 'bankofamerica-secure-login.com',
]);

const SCAM_TLD_RE = /\.(zip|mov|click|rest|top|xyz|cam|bond|cfd|sbs|gq|tk|ml|ga|cf|work|support|ru)$/i;

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

export function isSiteAllowed(rawUrl = location.href) {
  const url = String(rawUrl || '');
  if (!url || BLOCKED_PROTOCOLS.test(url)) return false;

  const host = hostnameFromUrl(url);
  if (!host) return false;

  if (hostMatchesSet(host, SENSITIVE_FINANCE_HOSTS)) return false;
  if (hostMatchesSet(host, BLOCKED_HOSTS)) return false;
  if (isPunycodeHomoglyph(host)) return false;
  if (SCAM_TLD_RE.test(host)) return false;
  if (pathLooksScammy(url)) return false;

  return true;
}
