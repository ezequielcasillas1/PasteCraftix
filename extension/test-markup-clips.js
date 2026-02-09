/**
 * PasteCraft Sample Clips — Demo showcase of all supported formats.
 * Remove this file and its script tag from popup.html when done.
 */
(async () => {
  'use strict';

  const FLAG = 'pc_sample_clips_v1';
  const result = await chrome.storage.local.get([FLAG]);
  if (result[FLAG]) return;

  const now = Date.now();
  const sampleClips = [

    // ── EVERYDAY CLIPS ──────────────────────────────────

    {
      id: now + 1,
      text: "Hey! Just wanted to follow up on yesterday's call. Can we schedule a quick sync for Thursday at 2pm? I have a few updates on the redesign. Let me know what works — thanks!",
      category: 'Work',
      timestamp: now + 1,
      meta: { kind: 'text', plainText: '', capturedAt: now + 1 }
    },

    {
      id: now + 2,
      text: "Grocery list:\n- Almond milk\n- Eggs (free range)\n- Sourdough bread\n- Avocados x3\n- Greek yogurt\n- Chicken breast\n- Spinach\n- Lemons",
      category: 'Personal',
      timestamp: now + 2,
      meta: { kind: 'text', plainText: '', capturedAt: now + 2 }
    },

    {
      id: now + 3,
      text: "Wi-Fi Password: PasteCraft2026!\nNetwork: PC-Office-5G",
      category: 'Personal',
      timestamp: now + 3,
      meta: { kind: 'text', plainText: '', capturedAt: now + 3 }
    },

    {
      id: now + 4,
      text: "https://github.com/nicepaste/pastecraft/pull/147",
      category: 'Dev',
      timestamp: now + 4,
      meta: { kind: 'url', plainText: '', capturedAt: now + 4 }
    },

    {
      id: now + 5,
      text: "Meeting Notes — Feb 7\n\nAttendees: Ezequiel, Sarah, Mike\n\nDecisions:\n1. Ship markup rendering by Friday\n2. Push subscription flow to Sprint 16\n3. Design review Monday at 10am\n\nAction Items:\n- Ezequiel: Finalize renderer + write samples\n- Sarah: Update Figma mocks for Clip Viewer\n- Mike: Load test Supabase sync with 5k clips",
      category: 'Work',
      timestamp: now + 5,
      meta: { kind: 'text', plainText: '', capturedAt: now + 5 }
    },

    // ── MARKDOWN ────────────────────────────────────────

    {
      id: now + 6,
      text: "# PasteCraft v3.1 — Release Notes\n\n## Highlights\n\n- **20 markup languages** now auto-detected and rendered\n- *Syntax highlighting* for ~190 programming languages\n- ~~Old plain-text viewer~~ replaced with rich Clip Viewer\n\n### Supported Formats\n\n| Category | Formats |\n|----------|----------|\n| Document | Markdown, HTML, AsciiDoc, rST, Org-mode, Textile |\n| Data | JSON, YAML, TOML, XML, CSV, TSV |\n| Code | 190+ languages with auto-detect |\n| Diagrams | Mermaid (flowcharts, sequences, etc.) |\n| Math | LaTeX, KaTeX |\n\n> \"The clipboard manager that actually understands what you copied.\"\n\n[Full changelog →](https://pastecraft.com/changelog)",
      category: 'Dev',
      timestamp: now + 6,
      meta: { kind: 'text', plainText: '', capturedAt: now + 6 }
    },

    // ── JSON ────────────────────────────────────────────

    {
      id: now + 7,
      text: '{\n  "user": {\n    "id": "usr_8x29fk",\n    "name": "Ezequiel Casillas",\n    "email": "ez@pastecraft.com",\n    "plan": "enhanced",\n    "clips_count": 1247,\n    "storage_used_mb": 18.4\n  },\n  "subscription": {\n    "status": "active",\n    "renewal": "2026-03-15",\n    "price": 4.99\n  }\n}',
      category: 'Dev',
      timestamp: now + 7,
      meta: { kind: 'text', plainText: '', capturedAt: now + 7 }
    },

    // ── HTML ────────────────────────────────────────────

    {
      id: now + 8,
      text: '<div class="email-header">\n  <h2>Your PasteCraft Weekly Digest</h2>\n  <p>Here\'s what you clipped this week:</p>\n  <table>\n    <tr><th>Category</th><th>Clips</th></tr>\n    <tr><td>Work</td><td>34</td></tr>\n    <tr><td>Dev</td><td>28</td></tr>\n    <tr><td>Personal</td><td>12</td></tr>\n  </table>\n  <p><a href="https://pastecraft.com/dashboard">View full dashboard →</a></p>\n</div>',
      category: 'Work',
      timestamp: now + 8,
      meta: { kind: 'html', plainText: 'Your PasteCraft Weekly Digest...', html: '<div class="email-header"><h2>Your PasteCraft Weekly Digest</h2><p>Here\'s what you clipped this week:</p><table><tr><th>Category</th><th>Clips</th></tr><tr><td>Work</td><td>34</td></tr><tr><td>Dev</td><td>28</td></tr><tr><td>Personal</td><td>12</td></tr></table><p><a href="https://pastecraft.com/dashboard">View full dashboard →</a></p></div>', capturedAt: now + 8 }
    },

    // ── YAML ────────────────────────────────────────────

    {
      id: now + 9,
      text: "version: '3.8'\nservices:\n  api:\n    build: ./api\n    ports:\n      - \"3000:3000\"\n    environment:\n      DATABASE_URL: postgres://pc:secret@db:5432/pastecraft\n      SUPABASE_KEY: ${SUPABASE_KEY}\n    depends_on:\n      - db\n      - redis\n\n  db:\n    image: postgres:16-alpine\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n\n  redis:\n    image: redis:7-alpine\n    ports:\n      - \"6379:6379\"\n\nvolumes:\n  pgdata:",
      category: 'Dev',
      timestamp: now + 9,
      meta: { kind: 'text', plainText: '', capturedAt: now + 9 }
    },

    // ── XML ─────────────────────────────────────────────

    {
      id: now + 10,
      text: '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>PasteCraft Blog</title>\n    <link>https://pastecraft.com/blog</link>\n    <item>\n      <title>Introducing Markup Rendering</title>\n      <pubDate>Sat, 08 Feb 2026</pubDate>\n      <description>PasteCraft now renders 20 markup languages inline.</description>\n    </item>\n    <item>\n      <title>Cloud Sync is Live</title>\n      <pubDate>Mon, 20 Jan 2026</pubDate>\n      <description>Sync your clips across all devices instantly.</description>\n    </item>\n  </channel>\n</rss>',
      category: 'Dev',
      timestamp: now + 10,
      meta: { kind: 'text', plainText: '', capturedAt: now + 10 }
    },

    // ── LATEX / MATH ────────────────────────────────────

    {
      id: now + 11,
      text: "The quadratic formula:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nEuler's identity: $e^{i\\pi} + 1 = 0$\n\nGaussian integral:\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\, dx = \\sqrt{\\pi}$$\n\nBasel problem: $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$",
      category: 'School',
      timestamp: now + 11,
      meta: { kind: 'text', plainText: '', capturedAt: now + 11 }
    },

    {
      id: now + 12,
      text: "Maxwell's equations in differential form:\n\n$$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$$\n\n$$\\nabla \\cdot \\mathbf{B} = 0$$\n\n$$\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}$$\n\n$$\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}$$",
      category: 'School',
      timestamp: now + 12,
      meta: { kind: 'text', plainText: '', capturedAt: now + 12 }
    },

    // ── MERMAID DIAGRAM ─────────────────────────────────

    {
      id: now + 13,
      text: "graph LR\n    A[Copy Text] --> B{Detect Format}\n    B -->|Markdown| C[marked.js]\n    B -->|Code| D[highlight.js]\n    B -->|Math| E[KaTeX]\n    B -->|Diagram| F[Mermaid]\n    B -->|Data| G[Table / Highlight]\n    B -->|Plain| H[As-is]\n    C --> I[DOMPurify]\n    D --> I\n    E --> I\n    F --> I\n    G --> I\n    H --> I\n    I --> J[Clip Viewer]",
      category: 'Dev',
      timestamp: now + 13,
      meta: { kind: 'text', plainText: '', capturedAt: now + 13 }
    },

    // ── CSV ─────────────────────────────────────────────

    {
      id: now + 14,
      text: "Employee,Department,Salary,Start Date\nEzequiel Casillas,Engineering,125000,2022-03-15\nSarah Kim,Design,98000,2023-01-10\nMike Johnson,Backend,115000,2022-09-01\nLisa Chen,Product,105000,2023-06-20\nJames Park,DevOps,110000,2024-02-14",
      category: 'Work',
      timestamp: now + 14,
      meta: { kind: 'text', plainText: '', capturedAt: now + 14 }
    },

    // ── TSV ─────────────────────────────────────────────

    {
      id: now + 15,
      text: "Date\tRevenue\tUsers\tClips Created\n2026-02-01\t$2,340\t1,205\t18,402\n2026-02-02\t$2,180\t1,189\t17,891\n2026-02-03\t$2,510\t1,302\t19,744\n2026-02-04\t$2,890\t1,418\t21,003\n2026-02-05\t$3,120\t1,534\t23,210",
      category: 'Work',
      timestamp: now + 15,
      meta: { kind: 'text', plainText: '', capturedAt: now + 15 }
    },

    // ── TOML ────────────────────────────────────────────

    {
      id: now + 16,
      text: "[package]\nname = \"pastecraft-cli\"\nversion = \"1.2.0\"\nauthors = [\"Ezequiel Casillas <ez@pastecraft.com>\"]\nedition = \"2024\"\n\n[dependencies]\nclap = { version = \"4.5\", features = [\"derive\"] }\nserde = { version = \"1.0\", features = [\"derive\"] }\nreqwest = { version = \"0.12\", features = [\"json\"] }\ntokio = { version = \"1\", features = [\"full\"] }\n\n[profile.release]\nopt-level = 3\nstrip = true",
      category: 'Dev',
      timestamp: now + 16,
      meta: { kind: 'text', plainText: '', capturedAt: now + 16 }
    },

    // ── BBCODE ──────────────────────────────────────────

    {
      id: now + 17,
      text: "[b]PasteCraft v3.1 is here![/b]\n\n[i]Posted by ezequiel — Feb 8, 2026[/i]\n\nWe just shipped the biggest update yet:\n\n[list]\n[*]20 markup languages rendered inline\n[*]190+ code languages with syntax highlighting\n[*]Math equations with KaTeX\n[*]Diagrams with Mermaid\n[/list]\n\n[quote]Honestly the best clipboard tool I've used. The markup rendering is insane.[/quote]\n\n[url=https://pastecraft.com/download]Download now[/url] or [url=https://pastecraft.com/changelog]read the changelog[/url].",
      category: 'Notes',
      timestamp: now + 17,
      meta: { kind: 'text', plainText: '', capturedAt: now + 17 }
    },

    // ── SLACK / DISCORD ─────────────────────────────────

    {
      id: now + 18,
      text: "*Hey team!* Quick Friday update:\n\n_Sprint 15 wrapped up_ and here's where we landed:\n- ~Old plain text viewer~ replaced with rich markup renderer\n- New `PCMarkup.renderMarkup()` powers all clip views\n- `detectMarkupType()` now handles 20 formats\n\n>>> Heads up: We're cutting the release branch Monday morning. Please get your PRs merged by EOD Sunday.",
      category: 'Work',
      timestamp: now + 18,
      meta: { kind: 'text', plainText: '', capturedAt: now + 18 }
    },

    // ── FENCED CODE BLOCK ───────────────────────────────

    {
      id: now + 19,
      text: "```typescript\ninterface Clip {\n  id: string;\n  text: string;\n  category: string;\n  timestamp: number;\n  meta?: {\n    kind: 'text' | 'html' | 'image' | 'url';\n    html?: string;\n    plainText?: string;\n  };\n}\n\nasync function syncClips(clips: Clip[]): Promise<void> {\n  const { error } = await supabase\n    .from('clips')\n    .upsert(clips, { onConflict: 'id' });\n\n  if (error) throw new Error(`Sync failed: ${error.message}`);\n  console.log(`Synced ${clips.length} clips`);\n}\n```",
      category: 'Dev',
      timestamp: now + 19,
      meta: { kind: 'text', plainText: '', capturedAt: now + 19 }
    },

    // ── ASCIIDOC ────────────────────────────────────────

    {
      id: now + 20,
      text: "= PasteCraft Quick Start Guide\n\n.About\nPasteCraft is a clipboard manager with built-in markup rendering.\n\n== Installation\n\n.Chrome Web Store\n[source, bash]\n----\n# Or load unpacked from source:\ngit clone https://github.com/nicepaste/pastecraft.git\n----\n\n== Features\n\n**20 markup languages** with auto-detection.\n_Syntax highlighting_ for 190+ code languages.\n\n* Cloud sync across devices\n* AI-powered clip analysis\n* Rich formatting in Clip Viewer",
      category: 'Notes',
      timestamp: now + 20,
      meta: { kind: 'text', plainText: '', capturedAt: now + 20 }
    },

    // ── RESTRUCTUREDTEXT ────────────────────────────────

    {
      id: now + 21,
      text: "PasteCraft API Reference\n========================\n\n.. module:: pastecraft\n\nIntroduction\n------------\n\nThe PasteCraft SDK lets you interact with clips programmatically.\n\n**Bold text** and *italic text* are supported throughout.\n\n``PCMarkup.detectMarkupType(text, meta)`` returns the detected format.\n\n.. warning::\n   Always sanitize rendered HTML with DOMPurify before injection.",
      category: 'Dev',
      timestamp: now + 21,
      meta: { kind: 'text', plainText: '', capturedAt: now + 21 }
    },

    // ── ORG-MODE ────────────────────────────────────────

    {
      id: now + 22,
      text: "#+TITLE: Weekly Plan\n#+AUTHOR: Ezequiel\n\n* TODO Ship markup rendering\n** DONE Implement detection for 20 formats\n** DONE Add syntax highlighting\n** TODO Record demo video for launch\n* IN-PROGRESS Subscription billing\n  /Stripe webhook/ integration is *almost done*.\n  ~stripe-webhook/index.ts~ needs final testing.\n* Notes\n  =Verbatim config= values: +deprecated flags removed+",
      category: 'Personal',
      timestamp: now + 22,
      meta: { kind: 'text', plainText: '', capturedAt: now + 22 }
    },

    // ── MEDIAWIKI ───────────────────────────────────────

    {
      id: now + 23,
      text: "== PasteCraft ==\n\n'''PasteCraft''' is a [[clipboard manager]] [[browser extension]] developed by [[Ezequiel Casillas]].\n\n=== Features ===\n\n* ''Cloud synchronization'' across devices\n* [[Markup language|Markup rendering]] for 20+ formats\n* {{Infobox software|license=Freemium}}\n\n=== History ===\n\nPasteCraft was first released in 2025 as a simple clipboard tool. Version 3.1 introduced comprehensive markup rendering.\n\n[https://pastecraft.com Official website]\n\n----\n\n== See also ==\n\n* [[Clipboard (computing)]]\n* [[Browser extension]]",
      category: 'Notes',
      timestamp: now + 23,
      meta: { kind: 'text', plainText: '', capturedAt: now + 23 }
    },

    // ── JIRA / CONFLUENCE ───────────────────────────────

    {
      id: now + 24,
      text: "h1. PC-347: Markup Rendering Engine\n\nh2. Description\n\nImplement auto-detection and rendering for 20 markup formats across Clips, Search, Categories, and Clip Viewer.\n\n* *Scope:* All clip display surfaces\n* _Priority:_ High\n* -Deferred to Sprint 16- Completed in Sprint 15\n\n{code:javascript}\nconst type = PCMarkup.detectMarkupType(clip.text, clip.meta);\nconst html = PCMarkup.renderMarkup(clip.text, clip.meta);\n{code}\n\n{panel:title=Acceptance Criteria}\n* All 20 formats detected correctly\n* [~ezequiel] verified with 26 sample clips\n* {{View Raw}} toggle works in Clip Viewer\n{panel}\n\n{color:green}Status: SHIPPED{color}",
      category: 'Work',
      timestamp: now + 24,
      meta: { kind: 'text', plainText: '', capturedAt: now + 24 }
    },

    // ── TEXTILE ─────────────────────────────────────────

    {
      id: now + 25,
      text: "h1. PasteCraft Design System\n\nh2. Typography\n\np. PasteCraft uses a *clean, modern* typeface with _subtle accents_ for readability.\n\nbq. Good design is as little design as possible. — Dieter Rams\n\nh3. Component Library\n\n* Buttons: primary, secondary, ghost\n* Badges: markup type indicators\n* -Deprecated tooltip component- removed in v3.1\n* +Underlined links+ for accessibility\n\n@font-family: 'Inter', system-ui, sans-serif;@\n\n\"View the Figma file\":https://figma.com/pastecraft-ds",
      category: 'Work',
      timestamp: now + 25,
      meta: { kind: 'text', plainText: '', capturedAt: now + 25 }
    },

    // ── RAW CODE (unfenced) ─────────────────────────────

    // JavaScript / React
    {
      id: now + 26,
      text: "import { useState, useEffect } from 'react';\n\nexport default function ClipList({ userId }) {\n  const [clips, setClips] = useState([]);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    async function fetchClips() {\n      const res = await fetch(`/api/clips?user=${userId}`);\n      const data = await res.json();\n      setClips(data.clips);\n      setLoading(false);\n    }\n    fetchClips();\n  }, [userId]);\n\n  if (loading) return <div className=\"spinner\" />;\n\n  return (\n    <ul className=\"clip-list\">\n      {clips.map(clip => (\n        <li key={clip.id}>{clip.text}</li>\n      ))}\n    </ul>\n  );\n}",
      category: 'Dev',
      timestamp: now + 26,
      meta: { kind: 'text', plainText: '', capturedAt: now + 26 }
    },

    // Python
    {
      id: now + 27,
      text: "from datetime import datetime\nfrom typing import Optional\n\nclass ClipStore:\n    def __init__(self, max_size: int = 500):\n        self.clips: list[dict] = []\n        self.max_size = max_size\n\n    def add(self, text: str, category: str = 'General') -> dict:\n        clip = {\n            'id': len(self.clips) + 1,\n            'text': text,\n            'category': category,\n            'created': datetime.now().isoformat()\n        }\n        self.clips.insert(0, clip)\n        if len(self.clips) > self.max_size:\n            self.clips.pop()\n        return clip\n\n    def search(self, query: str) -> list[dict]:\n        q = query.lower()\n        return [c for c in self.clips if q in c['text'].lower()]\n\nif __name__ == '__main__':\n    store = ClipStore()\n    store.add('Hello from Python!', 'Greetings')\n    print(store.search('hello'))",
      category: 'Dev',
      timestamp: now + 27,
      meta: { kind: 'text', plainText: '', capturedAt: now + 27 }
    },

    // C
    {
      id: now + 28,
      text: "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\ntypedef struct {\n    int id;\n    char text[256];\n    char category[64];\n} Clip;\n\nvoid print_clip(const Clip *c) {\n    printf(\"[%d] %s (%s)\\n\", c->id, c->text, c->category);\n}\n\nint main(void) {\n    Clip clipboard[100];\n    int count = 0;\n\n    clipboard[count].id = 1;\n    strcpy(clipboard[count].text, \"Hello from C!\");\n    strcpy(clipboard[count].category, \"General\");\n    count++;\n\n    for (int i = 0; i < count; i++) {\n        print_clip(&clipboard[i]);\n    }\n    return 0;\n}",
      category: 'Dev',
      timestamp: now + 28,
      meta: { kind: 'text', plainText: '', capturedAt: now + 28 }
    },

    // Go
    {
      id: now + 29,
      text: "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"time\"\n)\n\ntype Clip struct {\n\tID        int       `json:\"id\"`\n\tText      string    `json:\"text\"`\n\tCategory  string    `json:\"category\"`\n\tCreatedAt time.Time `json:\"created_at\"`\n}\n\nfunc handleGetClips(w http.ResponseWriter, r *http.Request) {\n\tclips := []Clip{\n\t\t{ID: 1, Text: \"Hello from Go!\", Category: \"General\", CreatedAt: time.Now()},\n\t}\n\tw.Header().Set(\"Content-Type\", \"application/json\")\n\tjson.NewEncoder(w).Encode(clips)\n}\n\nfunc main() {\n\thttp.HandleFunc(\"/api/clips\", handleGetClips)\n\tfmt.Println(\"Server running on :8080\")\n\thttp.ListenAndServe(\":8080\", nil)\n}",
      category: 'Dev',
      timestamp: now + 29,
      meta: { kind: 'text', plainText: '', capturedAt: now + 29 }
    },

    // SQL
    {
      id: now + 30,
      text: "CREATE TABLE clips (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id UUID REFERENCES users(id) ON DELETE CASCADE,\n    text TEXT NOT NULL,\n    category VARCHAR(64) DEFAULT 'General',\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE INDEX idx_clips_user ON clips(user_id);\nCREATE INDEX idx_clips_created ON clips(created_at DESC);\n\nSELECT c.id, c.text, c.category, c.created_at,\n       u.name AS user_name\nFROM clips c\nJOIN users u ON u.id = c.user_id\nWHERE c.user_id = 'usr_8x29fk'\n  AND c.created_at > NOW() - INTERVAL '7 days'\nORDER BY c.created_at DESC\nLIMIT 50;",
      category: 'Dev',
      timestamp: now + 30,
      meta: { kind: 'text', plainText: '', capturedAt: now + 30 }
    },

    // Bash
    {
      id: now + 31,
      text: "#!/bin/bash\n\n# Deploy PasteCraft extension to Chrome Web Store\nset -euo pipefail\n\nVERSION=$(jq -r '.version' extension/manifest.json)\nBUILD_DIR=\"dist\"\n\necho \"Building PasteCraft v$VERSION...\"\nmkdir -p \"$BUILD_DIR\"\n\n# Bundle extension\ncp -r extension/* \"$BUILD_DIR/\"\nrm -f \"$BUILD_DIR/test-markup-clips.js\"\n\n# Create zip for upload\ncd \"$BUILD_DIR\"\nzip -r \"../pastecraft-v${VERSION}.zip\" . -x '*.DS_Store'\ncd ..\n\necho \"Package ready: pastecraft-v${VERSION}.zip\"\necho \"Upload at: https://chrome.google.com/webstore/devconsole\"",
      category: 'Dev',
      timestamp: now + 31,
      meta: { kind: 'text', plainText: '', capturedAt: now + 31 }
    },

    // ── MORE EVERYDAY CLIPS ─────────────────────────────

    {
      id: now + 32,
      text: "Shipping address:\nEzequiel Casillas\n742 Evergreen Terrace, Apt 4B\nSan Francisco, CA 94110",
      category: 'Personal',
      timestamp: now + 32,
      meta: { kind: 'text', plainText: '', capturedAt: now + 32 }
    },

    {
      id: now + 33,
      text: "Book recommendations from the team:\n\n1. \"Designing Data-Intensive Applications\" — Martin Kleppmann\n2. \"The Pragmatic Programmer\" — Hunt & Thomas\n3. \"Refactoring UI\" — Wathan & Schoger\n4. \"Staff Engineer\" — Will Larson\n5. \"Building a Second Brain\" — Tiago Forte",
      category: 'Personal',
      timestamp: now + 33,
      meta: { kind: 'text', plainText: '', capturedAt: now + 33 }
    },

    {
      id: now + 34,
      text: "color palette for the new landing page:\n\nPrimary:    #6366f1 (Indigo)\nSecondary:  #10b981 (Emerald)\nBackground: #f8fafc (Slate 50)\nText:       #0f172a (Slate 900)\nAccent:     #f59e0b (Amber)",
      category: 'Work',
      timestamp: now + 34,
      meta: { kind: 'text', plainText: '', capturedAt: now + 34 }
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

  console.log('[PasteCraft] Loaded ' + sampleClips.length + ' sample clips.');
})();
