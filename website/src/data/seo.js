export const SITE_URL = 'https://pastecraft.com';
export const TWITTER_HANDLE = '@casiezeq';
export const OG_IMAGE_PATH = '/og-image.jpg';
export const OG_IMAGE_ALT = 'PasteCraft smart clipboard manager extension for Chrome and Edge';

export const TITLE_MIN = 30;
export const TITLE_MAX = 60;
export const DESC_MIN = 120;
export const DESC_MAX = 160;

export const DEFAULT_KEYWORDS =
  'clipboard manager extension, smart clipboard manager extension, clipboard manager, clipboard history, browser extension, chrome extension, clipboard organizer, cloud sync clipboard, copy paste tool, text snippets, productivity tool';

export const pageSeo = {
  '/': {
    title: 'Smart Clipboard Manager Extension | PasteCraft',
    description:
      'PasteCraft is a smart clipboard manager extension for Chrome and Edge. Save unlimited clips, organize by category, and sync your library.',
    robots: 'index, follow',
    changefreq: 'weekly',
    priority: '1.0',
  },
  '/about': {
    title: 'About PasteCraft | Clipboard Manager Extension',
    description:
      'Learn why PasteCraft exists as a clipboard manager extension and how it treats history, sync, and optional AI as a calm product for students and builders.',
    robots: 'index, follow',
    changefreq: 'monthly',
    priority: '0.7',
  },
  '/pricing': {
    title: 'PasteCraft Pricing | Free, Sync, and AI Lab Plans',
    description:
      'Compare PasteCraft Freemium, Basic, and Enhanced. Start free on your device, add cloud sync, or unlock AI Lab. Subscribe in the extension after you install.',
    robots: 'index, follow',
    changefreq: 'weekly',
    priority: '0.9',
  },
  '/contact': {
    title: 'Contact PasteCraft | Support, Privacy, and Legal Help',
    description:
      'Reach the PasteCraft team for extension support, privacy requests, or legal questions. Include your browser, plan, and what went wrong so we can help.',
    robots: 'index, follow',
    changefreq: 'monthly',
    priority: '0.6',
  },
  '/support': {
    title: 'PasteCraft Support | Clipboard Manager Extension Help',
    description:
      'Get help with this clipboard manager extension: install, cloud sync, billing, and AI Lab. Read common answers or email support@pastecraft.com.',
    robots: 'index, follow',
    changefreq: 'monthly',
    priority: '0.7',
  },
  '/privacy': {
    title: 'PasteCraft Privacy Policy | Data, AI, and Your Rights',
    description:
      'Read how PasteCraft handles account data, clip storage, AI processing, payments, and your rights. Contact privacy@pastecraft.com for access or deletion.',
    robots: 'index, follow',
    changefreq: 'yearly',
    priority: '0.4',
  },
  '/terms': {
    title: 'PasteCraft Terms of Use | Account Rules and Conduct',
    description:
      'Read the PasteCraft terms of use, including acceptable use, account duties, prohibited conduct, and how we enforce the rules when abuse occurs.',
    robots: 'index, follow',
    changefreq: 'yearly',
    priority: '0.4',
  },
  '/upgrade': {
    title: 'Upgrade PasteCraft | Unlock Cloud Sync and AI Lab',
    description:
      'Unlock PasteCraft cloud sync and AI Lab for study and work. Compare Basic and Enhanced, then subscribe inside the extension after you install.',
    robots: 'index, follow',
    changefreq: 'monthly',
    priority: '0.6',
  },
  '/scholar-vs-merchant': {
    title: 'PasteCraft Scholar vs Merchant | Who Should Use Each',
    description:
      'See how PasteCraft Scholar helps study and building, how Merchant helps sellers, and which layer to use. Same extension, two service layers.',
    keywords:
      'PasteCraft Scholar, PasteCraft Merchant, clipboard manager extension, smart clipboard manager extension, clipboard manager use cases, vibe coding clipboard, study notes clipboard, Etsy listing paste, seller tag queue, clipboard productivity',
    robots: 'index, follow',
    changefreq: 'monthly',
    priority: '0.8',
  },
  '/changelog': {
    title: 'PasteCraft Changelog | Updates for Chrome and Edge',
    description:
      'See updates for this clipboard manager extension across clips, AI Lab, Notes, Merchant, and Chrome and Edge store releases. Newest first.',
    keywords:
      'PasteCraft changelog, clipboard manager extension, smart clipboard manager extension, clipboard manager updates, Chrome extension release notes, Edge Add-ons updates, AI Lab, Merchant',
    robots: 'index, follow',
    changefreq: 'weekly',
    priority: '0.7',
  },
  '/account': {
    title: 'PasteCraft Account | Sign In and Manage Your Plan',
    description:
      'Sign in to PasteCraft to review your plan, reset your password, and manage account preferences from the website dashboard.',
    robots: 'noindex, nofollow',
  },
  '/success': {
    title: 'Payment Successful | PasteCraft Premium Is Active',
    description:
      'Your PasteCraft payment succeeded and premium features are active. Open the extension to start using cloud sync and AI Lab tools.',
    robots: 'noindex, nofollow',
  },
  '/testerinfo': {
    title: 'PasteCraft Tester Info | Basic Plan Test Checklist',
    description:
      'Checklist for validating the PasteCraft Basic plan: cloud sync, plan enforcement, and account behavior during tester sessions.',
    robots: 'noindex, nofollow',
  },
  '/reset-password': {
    title: 'PasteCraft Password Reset | Set Your New Password',
    description:
      'Set a new PasteCraft password on the website, then return to the extension and sign in with that password. The link expires after use.',
    robots: 'noindex, nofollow',
  },
  '/merchant-test': {
    title: 'Merchant Test Lab | PasteCraft Seller QA Mock Pages',
    description:
      'Internal PasteCraft Merchant Test Lab with mock seller listing pages for extension QA. This page is not a public marketing destination.',
    robots: 'noindex, nofollow',
  },
};

export function normalizeSeoPath(path = '/') {
  const raw = String(path || '/').trim() || '/';
  const noQuery = raw.split('?')[0].split('#')[0];
  let normalized = noQuery.replace(/\.html$/i, '');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.startsWith('/merchant-test/')) {
    return '/merchant-test';
  }
  return normalized || '/';
}

export function getPageSeo(path = '/') {
  const key = normalizeSeoPath(path);
  const entry = pageSeo[key] || pageSeo['/'];
  return {
    path: key,
    keywords: DEFAULT_KEYWORDS,
    ...entry,
  };
}

export function isIndexableSeo(entry) {
  const robots = String(entry?.robots || '');
  return robots.includes('index') && !robots.includes('noindex');
}

export function listIndexablePages() {
  return Object.entries(pageSeo)
    .filter(([, entry]) => isIndexableSeo(entry))
    .map(([path, entry]) => ({ path, ...entry }));
}

export function listNoindexPaths() {
  return Object.entries(pageSeo)
    .filter(([, entry]) => !isIndexableSeo(entry))
    .map(([path]) => path);
}

export function renderRobotsTxt() {
  const disallow = listNoindexPaths().flatMap((path) => {
    if (path === '/merchant-test') {
      return ['/merchant-test', '/merchant-test.html', '/merchant-test/'];
    }
    return [path, `${path}.html`];
  });

  return [
    'User-agent: *',
    'Allow: /',
    ...disallow.map((rule) => `Disallow: ${rule}`),
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

export function renderSitemapXml(lastmod = new Date().toISOString().slice(0, 10)) {
  const urls = listIndexablePages()
    .map((page) => {
      const loc = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`;
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${page.changefreq || 'monthly'}</changefreq>`,
        `    <priority>${page.priority || '0.5'}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}
