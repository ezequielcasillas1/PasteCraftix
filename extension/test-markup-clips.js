/**
 * PasteCraft Sample Clips — Demo showcase of all supported formats.
 * Remove this file and its script tag from popup.html when done.
 */
(async () => {
  'use strict';

  const FLAG = 'pc_sample_clips_v2';
  const result = await chrome.storage.local.get([FLAG]);
  if (result[FLAG]) return;

  const now = Date.now();
  const sampleClips = [

    // ── 1. MARKDOWN ─────────────────────────────────────

    {
      id: now + 1,
      text: "# PasteCraft v3.1 — Release Notes\n\n## Highlights\n\n- **20 markup languages** now auto-detected and rendered\n- *Syntax highlighting* for ~190 programming languages\n- ~~Old plain-text viewer~~ replaced with rich Clip Viewer\n\n### Supported Formats\n\n| Category | Formats |\n|----------|----------|\n| Document | Markdown, HTML, AsciiDoc, rST, Org-mode, Textile |\n| Data | JSON, YAML, TOML, XML, CSV, TSV |\n| Code | 190+ languages with auto-detect |\n| Diagrams | Mermaid (flowcharts, sequences, etc.) |\n| Math | LaTeX, KaTeX |\n\n> \"The clipboard manager that actually understands what you copied.\"\n\n[Full changelog →](https://pastecraft.com/changelog)",
      category: 'Dev',
      timestamp: now + 1,
      meta: { kind: 'text', plainText: '', capturedAt: now + 1 }
    },

    // ── 2. JSON ─────────────────────────────────────────

    {
      id: now + 2,
      text: '{\n  "user": {\n    "id": "usr_8x29fk",\n    "name": "Ezequiel Casillas",\n    "email": "ez@pastecraft.com",\n    "plan": "enhanced",\n    "clips_count": 1247,\n    "storage_used_mb": 18.4\n  },\n  "subscription": {\n    "status": "active",\n    "renewal": "2026-03-15",\n    "price": 4.99\n  }\n}',
      category: 'Dev',
      timestamp: now + 2,
      meta: { kind: 'text', plainText: '', capturedAt: now + 2 }
    },

    // ── 3. HTML ─────────────────────────────────────────

    {
      id: now + 3,
      text: '<div class="email-header">\n  <h2>Your PasteCraft Weekly Digest</h2>\n  <p>Here\'s what you clipped this week:</p>\n  <table>\n    <tr><th>Category</th><th>Clips</th></tr>\n    <tr><td>Work</td><td>34</td></tr>\n    <tr><td>Dev</td><td>28</td></tr>\n    <tr><td>Personal</td><td>12</td></tr>\n  </table>\n  <p><a href="https://pastecraft.com/dashboard">View full dashboard →</a></p>\n</div>',
      category: 'Work',
      timestamp: now + 3,
      meta: { kind: 'html', plainText: 'Your PasteCraft Weekly Digest...', html: '<div class="email-header"><h2>Your PasteCraft Weekly Digest</h2><p>Here\'s what you clipped this week:</p><table><tr><th>Category</th><th>Clips</th></tr><tr><td>Work</td><td>34</td></tr><tr><td>Dev</td><td>28</td></tr><tr><td>Personal</td><td>12</td></tr></table><p><a href="https://pastecraft.com/dashboard">View full dashboard →</a></p></div>', capturedAt: now + 3 }
    },

    // ── 4. YAML ─────────────────────────────────────────

    {
      id: now + 4,
      text: "version: '3.8'\nservices:\n  api:\n    build: ./api\n    ports:\n      - \"3000:3000\"\n    environment:\n      DATABASE_URL: postgres://pc:secret@db:5432/pastecraft\n      SUPABASE_KEY: ${SUPABASE_KEY}\n    depends_on:\n      - db\n      - redis\n\n  db:\n    image: postgres:16-alpine\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n\n  redis:\n    image: redis:7-alpine\n    ports:\n      - \"6379:6379\"\n\nvolumes:\n  pgdata:",
      category: 'Dev',
      timestamp: now + 4,
      meta: { kind: 'text', plainText: '', capturedAt: now + 4 }
    },

    // ── 5. XML ──────────────────────────────────────────

    {
      id: now + 5,
      text: '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>PasteCraft Blog</title>\n    <link>https://pastecraft.com/blog</link>\n    <item>\n      <title>Introducing Markup Rendering</title>\n      <pubDate>Sat, 08 Feb 2026</pubDate>\n      <description>PasteCraft now renders 20 markup languages inline.</description>\n    </item>\n    <item>\n      <title>Cloud Sync is Live</title>\n      <pubDate>Mon, 20 Jan 2026</pubDate>\n      <description>Sync your clips across all devices instantly.</description>\n    </item>\n  </channel>\n</rss>',
      category: 'Dev',
      timestamp: now + 5,
      meta: { kind: 'text', plainText: '', capturedAt: now + 5 }
    },

    // ── 6. LATEX / MATH ─────────────────────────────────

    {
      id: now + 6,
      text: "The quadratic formula:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nEuler's identity: $e^{i\\pi} + 1 = 0$\n\nGaussian integral:\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\, dx = \\sqrt{\\pi}$$\n\nBasel problem: $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$",
      category: 'School',
      timestamp: now + 6,
      meta: { kind: 'text', plainText: '', capturedAt: now + 6 }
    },

    // ── 7. MERMAID DIAGRAM ──────────────────────────────

    {
      id: now + 7,
      text: "graph LR\n    A[Copy Text] --> B{Detect Format}\n    B -->|Markdown| C[marked.js]\n    B -->|Code| D[highlight.js]\n    B -->|Math| E[KaTeX]\n    B -->|Diagram| F[Mermaid]\n    B -->|Data| G[Table / Highlight]\n    B -->|Plain| H[As-is]\n    C --> I[DOMPurify]\n    D --> I\n    E --> I\n    F --> I\n    G --> I\n    H --> I\n    I --> J[Clip Viewer]",
      category: 'Dev',
      timestamp: now + 7,
      meta: { kind: 'text', plainText: '', capturedAt: now + 7 }
    },

    // ── 8. CSV ──────────────────────────────────────────

    {
      id: now + 8,
      text: "Employee,Department,Salary,Start Date\nEzequiel Casillas,Engineering,125000,2022-03-15\nSarah Kim,Design,98000,2023-01-10\nMike Johnson,Backend,115000,2022-09-01\nLisa Chen,Product,105000,2023-06-20\nJames Park,DevOps,110000,2024-02-14",
      category: 'Work',
      timestamp: now + 8,
      meta: { kind: 'text', plainText: '', capturedAt: now + 8 }
    },

    // ── 9. TSV ──────────────────────────────────────────

    {
      id: now + 9,
      text: "Date\tRevenue\tUsers\tClips Created\n2026-02-01\t$2,340\t1,205\t18,402\n2026-02-02\t$2,180\t1,189\t17,891\n2026-02-03\t$2,510\t1,302\t19,744\n2026-02-04\t$2,890\t1,418\t21,003\n2026-02-05\t$3,120\t1,534\t23,210",
      category: 'Work',
      timestamp: now + 9,
      meta: { kind: 'text', plainText: '', capturedAt: now + 9 }
    },

    // ── 10. TOML ────────────────────────────────────────

    {
      id: now + 10,
      text: "[package]\nname = \"pastecraft-cli\"\nversion = \"1.2.0\"\nauthors = [\"Ezequiel Casillas <ez@pastecraft.com>\"]\nedition = \"2024\"\n\n[dependencies]\nclap = { version = \"4.5\", features = [\"derive\"] }\nserde = { version = \"1.0\", features = [\"derive\"] }\nreqwest = { version = \"0.12\", features = [\"json\"] }\ntokio = { version = \"1\", features = [\"full\"] }\n\n[profile.release]\nopt-level = 3\nstrip = true",
      category: 'Dev',
      timestamp: now + 10,
      meta: { kind: 'text', plainText: '', capturedAt: now + 10 }
    },

    // ── 11. BBCODE ──────────────────────────────────────

    {
      id: now + 11,
      text: "[b]PasteCraft v3.1 is here![/b]\n\n[i]Posted by ezequiel — Feb 8, 2026[/i]\n\nWe just shipped the biggest update yet:\n\n[list]\n[*]20 markup languages rendered inline\n[*]190+ code languages with syntax highlighting\n[*]Math equations with KaTeX\n[*]Diagrams with Mermaid\n[/list]\n\n[quote]Honestly the best clipboard tool I've used. The markup rendering is insane.[/quote]\n\n[url=https://pastecraft.com/download]Download now[/url] or [url=https://pastecraft.com/changelog]read the changelog[/url].",
      category: 'Notes',
      timestamp: now + 11,
      meta: { kind: 'text', plainText: '', capturedAt: now + 11 }
    },

    // ── 12. SLACK / DISCORD ─────────────────────────────

    {
      id: now + 12,
      text: "*Hey team!* Quick Friday update:\n\n_Sprint 15 wrapped up_ and here's where we landed:\n- ~Old plain text viewer~ replaced with rich markup renderer\n- New `PCMarkup.renderMarkup()` powers all clip views\n- `detectMarkupType()` now handles 20 formats\n\n>>> Heads up: We're cutting the release branch Monday morning. Please get your PRs merged by EOD Sunday.",
      category: 'Work',
      timestamp: now + 12,
      meta: { kind: 'text', plainText: '', capturedAt: now + 12 }
    },

    // ── 13. CODE (fenced) ───────────────────────────────

    {
      id: now + 13,
      text: "```typescript\ninterface Clip {\n  id: string;\n  text: string;\n  category: string;\n  timestamp: number;\n  meta?: {\n    kind: 'text' | 'html' | 'image' | 'url';\n    html?: string;\n    plainText?: string;\n  };\n}\n\nasync function syncClips(clips: Clip[]): Promise<void> {\n  const { error } = await supabase\n    .from('clips')\n    .upsert(clips, { onConflict: 'id' });\n\n  if (error) throw new Error(`Sync failed: ${error.message}`);\n  console.log(`Synced ${clips.length} clips`);\n}\n```",
      category: 'Dev',
      timestamp: now + 13,
      meta: { kind: 'text', plainText: '', capturedAt: now + 13 }
    },

    // ── 14. ASCIIDOC ────────────────────────────────────

    {
      id: now + 14,
      text: "= PasteCraft Quick Start Guide\n\n.About\nPasteCraft is a clipboard manager with built-in markup rendering.\n\n== Installation\n\n.Chrome Web Store\n[source, bash]\n----\n# Or load unpacked from source:\ngit clone https://github.com/nicepaste/pastecraft.git\n----\n\n== Features\n\n**20 markup languages** with auto-detection.\n_Syntax highlighting_ for 190+ code languages.\n\n* Cloud sync across devices\n* AI-powered clip analysis\n* Rich formatting in Clip Viewer",
      category: 'Notes',
      timestamp: now + 14,
      meta: { kind: 'text', plainText: '', capturedAt: now + 14 }
    },

    // ── 15. RESTRUCTUREDTEXT ────────────────────────────

    {
      id: now + 15,
      text: "PasteCraft API Reference\n========================\n\n.. module:: pastecraft\n\nIntroduction\n------------\n\nThe PasteCraft SDK lets you interact with clips programmatically.\n\n**Bold text** and *italic text* are supported throughout.\n\n``PCMarkup.detectMarkupType(text, meta)`` returns the detected format.\n\n.. warning::\n   Always sanitize rendered HTML with DOMPurify before injection.",
      category: 'Dev',
      timestamp: now + 15,
      meta: { kind: 'text', plainText: '', capturedAt: now + 15 }
    },

    // ── 16. ORG-MODE ────────────────────────────────────

    {
      id: now + 16,
      text: "#+TITLE: Weekly Plan\n#+AUTHOR: Ezequiel\n\n* TODO Ship markup rendering\n** DONE Implement detection for 20 formats\n** DONE Add syntax highlighting\n** TODO Record demo video for launch\n* IN-PROGRESS Subscription billing\n  /Stripe webhook/ integration is *almost done*.\n  ~stripe-webhook/index.ts~ needs final testing.\n* Notes\n  =Verbatim config= values: +deprecated flags removed+",
      category: 'Personal',
      timestamp: now + 16,
      meta: { kind: 'text', plainText: '', capturedAt: now + 16 }
    },

    // ── 17. MEDIAWIKI ───────────────────────────────────

    {
      id: now + 17,
      text: "== PasteCraft ==\n\n'''PasteCraft''' is a [[clipboard manager]] [[browser extension]] developed by [[Ezequiel Casillas]].\n\n=== Features ===\n\n* ''Cloud synchronization'' across devices\n* [[Markup language|Markup rendering]] for 20+ formats\n* {{Infobox software|license=Freemium}}\n\n=== History ===\n\nPasteCraft was first released in 2025 as a simple clipboard tool. Version 3.1 introduced comprehensive markup rendering.\n\n[https://pastecraft.com Official website]\n\n----\n\n== See also ==\n\n* [[Clipboard (computing)]]\n* [[Browser extension]]",
      category: 'Notes',
      timestamp: now + 17,
      meta: { kind: 'text', plainText: '', capturedAt: now + 17 }
    },

    // ── 18. JIRA / CONFLUENCE ───────────────────────────

    {
      id: now + 18,
      text: "h1. PC-347: Markup Rendering Engine\n\nh2. Description\n\nImplement auto-detection and rendering for 20 markup formats across Clips, Search, Categories, and Clip Viewer.\n\n* *Scope:* All clip display surfaces\n* _Priority:_ High\n* -Deferred to Sprint 16- Completed in Sprint 15\n\n{code:javascript}\nconst type = PCMarkup.detectMarkupType(clip.text, clip.meta);\nconst html = PCMarkup.renderMarkup(clip.text, clip.meta);\n{code}\n\n{panel:title=Acceptance Criteria}\n* All 20 formats detected correctly\n* [~ezequiel] verified with 26 sample clips\n* {{View Raw}} toggle works in Clip Viewer\n{panel}\n\n{color:green}Status: SHIPPED{color}",
      category: 'Work',
      timestamp: now + 18,
      meta: { kind: 'text', plainText: '', capturedAt: now + 18 }
    },

    // ── 19. TEXTILE ─────────────────────────────────────

    {
      id: now + 19,
      text: "h1. PasteCraft Design System\n\nh2. Typography\n\np. PasteCraft uses a *clean, modern* typeface with _subtle accents_ for readability.\n\nbq. Good design is as little design as possible. — Dieter Rams\n\nh3. Component Library\n\n* Buttons: primary, secondary, ghost\n* Badges: markup type indicators\n* -Deprecated tooltip component- removed in v3.1\n* +Underlined links+ for accessibility\n\n@font-family: 'Inter', system-ui, sans-serif;@\n\n\"View the Figma file\":https://figma.com/pastecraft-ds",
      category: 'Work',
      timestamp: now + 19,
      meta: { kind: 'text', plainText: '', capturedAt: now + 19 }
    },

  ];

  const storage = await chrome.storage.local.get(['clips']);
  const existing = Array.isArray(storage.clips) ? storage.clips : [];
  const merged = [...sampleClips, ...existing];

  await chrome.storage.local.set({
    clips: merged,
    [FLAG]: true,
    pc_local_updatedAt: Date.now()
  });

  // Clear old v1 samples if present
  await chrome.storage.local.remove('pc_sample_clips_v1');

  console.log('[PasteCraft] Loaded ' + sampleClips.length + ' markup sample clips (19 unique formats).');
})();
