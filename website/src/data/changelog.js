/** PasteCraft public changelog — user-facing store versions + product eras. */

export const changelogIntro = {
  eyebrow: 'Product history',
  title: 'PasteCraft changelog',
  copy: 'Release notes for this clipboard manager extension on Chrome and Edge, plus the website. Newest store versions first, then earlier product eras.',
};

export const changelogReleases = [
  {
    version: '3.0.37',
    date: '2026-08-15',
    title: 'Clip images, capture eligibility, and clearer summaries',
    highlights: [
      'Clip images save on your device first, then stay preserved in the cloud',
      'Selected category clips stay visible while you hover',
      'Dark-mode AI summaries make tables and diagrams easier to read',
      'Capture Tools eligibility and site-access grant for more Chromium browsers',
    ],
  },
  {
    version: '3.0.36',
    date: '2026-08-13',
    title: 'Notes catalog, GPT-5.4, and summary sources',
    highlights: [
      'Send a category’s clips to Notes from the category card',
      'Summit Craft (GPT-5.4) available in AI Lab',
      'AI summaries include source quotes and page URLs',
      'Store updates apply without uninstalling and reinstalling',
    ],
  },
  {
    version: '3.0.35',
    date: '2026-08-12',
    title: 'Category separators and AI Lab gateway',
    highlights: [
      'Named section separators inside categories for study organization',
      'Shared AI gateway routing for Craft Clips and summary workflows',
      'Fewer login and session errors when the popup opens',
      'Clip and module viewers wrap long code; expand and pop-out on every modal',
      'Notes write, PDF attach, and attachment viewer',
    ],
  },
  {
    version: '3.0.34',
    date: '2026-08-08',
    title: 'Auth hydrate and viewer stack',
    highlights: [
      'Auth preflight before session restore — fewer failed fetches on open',
      'CODE and text wrap inside modules instead of chopping sideways',
      'Expand-in-module and pop-out controls on every viewer',
      'Remembers popup UI location; Math and LaTeX clips from the August packets',
    ],
  },
  {
    version: '3.0.33',
    date: '2026-08-08',
    title: 'Viewer shell, Notes write, and Math clips',
    highlights: [
      'Shared viewer shell for wrap, expand, and pop-out',
      'Notes write and PDF attach with an attachment viewer',
      'Popup location memory',
      'MathJax and LaTeX clipboard markup for clips',
      'AI Lab history reference image and model persist',
    ],
  },
  {
    version: '3.0.30–3.0.32',
    date: '2026-08-03',
    title: 'Clipboard reliability and Drop ghost',
    highlights: [
      'Reliable offscreen clipboard writes for image clips',
      'Drop ghost feedback when dragging clips',
      'Chrome listing live on pastecraft.com alongside Edge',
      'Tester coverage expanded for image, PDF, widget, AI Lab, and sync',
    ],
  },
  {
    version: '3.0.28',
    date: '2026-07-26',
    title: 'Image copy, notes annotate, and funky header',
    highlights: [
      'Copy clip images as PNG through the offscreen clipboard path',
      'Notes and album fullscreen annotate plus Edit fullscreen',
      'Funky AI name showcase in the top header',
      'AI Lab model picker placements',
    ],
  },
  {
    version: '3.0.24',
    date: '2026-07-23',
    title: 'Permission narrowing',
    highlights: [
      'Optional clipboard read and optional site access instead of always-on extras',
      'Required hosts stay limited to Supabase, Google accounts, PasteCraft, and Azure blob',
    ],
  },
  {
    version: '3.0.9',
    date: '2026-05-22',
    title: 'Security hardening',
    highlights: [
      'Locked subscription RLS and admin alert auth',
      'AI name JWT gate and removed extension admin sign-in',
      'Site-guard blocklist and Shadow DOM for the widget and Quick Paste',
      'Coupon RLS and admin-action audit trail',
    ],
  },
  {
    version: '3.0.8',
    date: '2026-05-21',
    title: 'Craft Clips rebuild',
    highlights: [
      'Magic Wand rebuilt as Craft Clips with action cards',
      'AI Formatted polish or AI Refactoring (ELI5 through Wise Man)',
      'Smart categorize with AI title picker for premium users',
      'Craft settings for categorize, archive-duplicates, and refactor level',
    ],
  },
];

export const changelogEras = [
  {
    id: 'aug-2026',
    title: 'August 2026',
    summary: 'Citations, clip images, capture browsers, and study-ready categories.',
    highlights: [
      'AI Summary citations: clip URLs travel with the run; numbered source cards; no invented links',
      'Topic summaries can ground through the AI gateway when no clip URL exists',
      'Clip images moved off the 10MB chrome.storage quota into IndexedDB, then cloud preserve',
      'Capture Tools: Chrome, Edge, and Comet get Image Picker and Spot; Opera and Arc keep Auto-Copy and click-and-drag',
      'Opera site-access grant from the popup when the page needs permission',
      'Category separators with section arrows for study groups',
    ],
  },
  {
    id: 'jul-2026',
    title: 'July 2026',
    summary: 'Blue Dark Mode, Widgets, Liked clips, and safer local storage.',
    highlights: [
      'Blue Dark Mode across popup shell, tabs, AI Lab, Notes, and Craft Clips',
      'Widgets tab between Notes and AI History for sandboxed embed galleries',
      'Liked clips on the Clips tab and Quick View heart filter',
      'Freemium data-safety banner and local restore-point recovery',
      'One-shot local-to-cloud migrate when a paid sync plan unlocks',
      'Public /support page for store listings',
      'Popup tab loading screens and startup performance pass',
    ],
  },
  {
    id: 'jun-2026',
    title: 'June 2026',
    summary: 'Merchant seller layer, AI refactor dual-view, and Custom Search.',
    highlights: [
      'PasteCraft Merchant: top strip, Listing Dock, Pulse, tag queue, snippets, Seal & Ship',
      'Platform tag presets for Etsy, Printify, Shopify, Amazon, and more',
      'Merchant Test Lab mock listing pages for QA',
      'AI Refactor keeps the original clip and adds a sibling; viewer shows Original + Refactored',
      'Custom Search templates on clip Google menus',
      'Send to phone QR plus email share; SMS share removed',
      'Enhanced text credits: 4,000/week with rollover, 35,000/month, 500,000/year',
      'Header clip count next to Synced on every tab',
    ],
  },
  {
    id: 'may-2026',
    title: 'May 2026',
    summary: 'Modular slices, Craft Clips, and store packaging.',
    highlights: [
      'Vertical-slice refactor of popup, content, background, and Supabase client',
      'Craft Clips AI rebuild (#47) with format vs refactor modes',
      'AI conversation history numbered pagination',
      'Clip row Share and Open restored after the popup peel',
      'Credit-exhausted AI Lab card with Buy Credits and Upgrade Plan',
    ],
  },
  {
    id: 'apr-2026',
    title: 'April 2026',
    summary: 'Publishing safety, support email, and messaging hardening.',
    highlights: [
      'Chrome + Edge publishing safety: same zip, rising versions, no listing recreation',
      'Support tickets from the extension to support@pastecraft.com via Resend',
      'Hardened messaging, CSP, and HTML escaping',
      'Quick View iframe delivery restored so recent clips load',
      'Cached login always restores on startup',
    ],
  },
  {
    id: 'q1-2026',
    title: 'January–March 2026',
    summary: 'Cloud sync, albums, clip viewer, and the pricing cards you see today.',
    highlights: [
      'Cross-device diff sync and duplicate-clip fix',
      'Pricing page: Freemium, Basic, and Enhanced with weekly/monthly/yearly toggles',
      'Notes albums with attachment viewer, interlaying edit, and send-to-notes',
      'Rich auto-copy (plain + HTML) and the in-extension clip Open viewer',
      'Profile funky animal name plus save buttons',
      'Support forms for team, help, bugs, and improvement mailboxes',
      'Cross-tab settings sync for Auto-Copy and Quick Paste',
    ],
  },
  {
    id: 'late-2025',
    title: 'Late 2025',
    summary: 'The clipboard library that became PasteCraft: clips, categories, and Notes.',
    highlights: [
      'Manual text input to save clips without copying from a page',
      'Send to Notes from Clips and Search',
      'Clip Joiner (delimiter) with live examples and Clip Settings help',
      'Category multi-select bulk copy and delete',
      'Search multi-select copy and Clips quick multi-select delete',
      'Crafted Output editable across tabs',
      'Premium access and subscription management on the account page',
      'Unlimited Uncategorized clips; 150-clip cap on named categories',
    ],
  },
];

export function listChangelogVersions() {
  return changelogReleases.map((release) => release.version);
}
