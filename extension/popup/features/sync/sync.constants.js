/** Marketing / empty-state demo seed. Bump when prototype clips change. */
export const DEMO_SEED_VERSION = 4;

export function getDemoCategories(now = Date.now()) {
  return [
    { id: now - 900000, name: 'Code Snippets', icon: '💻', createdAt: now - 900000, updatedAt: now - 900000 },
    { id: now - 800000, name: 'Data & Tables', icon: '📊', createdAt: now - 800000, updatedAt: now - 800000 },
    { id: now - 700000, name: 'Links & URLs', icon: '🔗', createdAt: now - 700000, updatedAt: now - 700000 },
    { id: now - 600000, name: 'Email Templates', icon: '✉️', createdAt: now - 600000, updatedAt: now - 600000 },
    { id: now - 500000, name: 'AI Prompts', icon: '✨', createdAt: now - 500000, updatedAt: now - 500000 },
    { id: now - 400000, name: 'Quick Reference', icon: '📌', createdAt: now - 400000, updatedAt: now - 400000 },
    { id: now - 300000, name: 'Math & Formulas', icon: '∑', createdAt: now - 300000, updatedAt: now - 300000 },
    { id: now - 200000, name: 'Diagrams & Charts', icon: '🔀', createdAt: now - 200000, updatedAt: now - 200000 },
    { id: now - 100000, name: 'Notes & Docs', icon: '📝', createdAt: now - 100000, updatedAt: now - 100000 },
    { id: now - 50000, name: 'Work Templates', icon: '💼', createdAt: now - 50000, updatedAt: now - 50000 }
  ];
}

function clip(id, text, category, timestamp, markupHint) {
  const meta = markupHint
    ? { kind: 'text', plainText: '', capturedAt: timestamp, markupHint }
    : { kind: 'text', plainText: '', capturedAt: timestamp };
  return { id, text, category, timestamp, meta };
}

export function getDemoClips(now = Date.now()) {
  // Higher timestamp = closer to page 0 (newest-first sort).
  // index 0 is the hero clip on page 0.
  const t = (index) => now - index;

  return [
    // ── Markup showcase (all supported formats) — page 0 first ──
    clip('demo_md', `# PasteCraft — Clipboard that understands you

## Why teams switch
- **20+ markup formats** auto-detected and rendered
- *Syntax highlighting* for 190+ languages
- Cloud sync + AI Lab for Premium

| Use case | Benefit |
|----------|---------|
| Sales | Reuse email + proposal snippets |
| Engineering | Keep code, YAML, SQL ready to paste |
| Support | Templates + macros in one place |

> "The clipboard manager that actually understands what you copied."

[Get PasteCraft →](https://pastecraft.com)`, 'Notes & Docs', t(0), 'markdown'),

    clip('demo_json', `{
  "product": "PasteCraft",
  "plan": "premium",
  "features": ["cloud_sync", "ai_lab", "markup_render"],
  "metrics": {
    "clips_saved": 1284,
    "devices": 3,
    "time_saved_hours": 11.5
  },
  "contact": {
    "support": "support@pastecraft.com",
    "docs": "https://pastecraft.com/docs"
  }
}`, 'Data & Tables', t(1), 'json'),

    clip('demo_html', `<section class="pc-digest">
  <h2>Your PasteCraft Weekly Digest</h2>
  <p>Here's what your team clipped this week:</p>
  <table>
    <tr><th>Category</th><th>Clips</th></tr>
    <tr><td>Sales</td><td>42</td></tr>
    <tr><td>Engineering</td><td>67</td></tr>
    <tr><td>Support</td><td>31</td></tr>
  </table>
  <p><a href="https://pastecraft.com/dashboard">Open dashboard →</a></p>
</section>`, 'Work Templates', t(2), 'html'),

    clip('demo_yaml', `version: "3.8"
services:
  api:
    image: pastecraft/api:latest
    ports:
      - "3000:3000"
    environment:
      SUPABASE_URL: \${SUPABASE_URL}
      NODE_ENV: production
    depends_on:
      - redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
volumes:
  cache:`, 'Code Snippets', t(3), 'yaml'),

    clip('demo_xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PasteCraft Product Updates</title>
    <link>https://pastecraft.com/blog</link>
    <item>
      <title>Markup rendering for 20 formats</title>
      <pubDate>Wed, 08 Jul 2026</pubDate>
      <description>Markdown, LaTeX, Mermaid, JSON, YAML, and more — rendered inline.</description>
    </item>
    <item>
      <title>Cloud sync for teams</title>
      <pubDate>Mon, 15 Jun 2026</pubDate>
      <description>Keep clips in sync across Chrome and Edge.</description>
    </item>
  </channel>
</rss>`, 'Data & Tables', t(4), 'xml'),

    clip('demo_latex', `Quadratic formula:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Euler's identity: $e^{i\\pi} + 1 = 0$

Gaussian integral:

$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\, dx = \\sqrt{\\pi}$$

Basel problem: $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$`, 'Math & Formulas', t(5), 'latex'),

    clip('demo_mermaid', `graph LR
    A[Copy text] --> B{Detect format}
    B -->|Markdown| C[Rich preview]
    B -->|Code| D[Syntax highlight]
    B -->|Math| E[KaTeX]
    B -->|Diagram| F[Mermaid]
    B -->|Data| G[Table / JSON]
    C --> H[Clip Viewer]
    D --> H
    E --> H
    F --> H
    G --> H
    H --> I[Paste anywhere]`, 'Diagrams & Charts', t(6), 'mermaid'),

    clip('demo_csv', `Customer,Plan,MRR,Status,Owner
Acme Retail,Premium,199,Active,Jordan
Northwind Labs,Basic,49,Active,Sam
BrightCart,Premium,199,Trial,Alex
Harbor Foods,Free,0,Free,Casey
PixelForge,Premium,199,Active,Jordan`, 'Data & Tables', t(7), 'csv'),

    clip('demo_tsv', `Week\tSignups\tActivations\tPaid\tChurn
W1\t420\t310\t48\t2.1%
W2\t455\t338\t61\t1.8%
W3\t501\t372\t74\t1.6%
W4\t538\t401\t89\t1.4%`, 'Data & Tables', t(8), 'tsv'),

    clip('demo_toml', `[package]
name = "pastecraft-cli"
version = "1.2.0"
authors = ["PasteCraft <hello@pastecraft.com>"]
edition = "2024"

[dependencies]
clap = { version = "4.5", features = ["derive"] }
serde = { version = "1.0", features = ["derive"] }
reqwest = { version = "0.12", features = ["json"] }

[profile.release]
opt-level = 3
strip = true`, 'Code Snippets', t(9), 'toml'),

    clip('demo_bbcode', `[b]PasteCraft for forums & communities[/b]

[i]Ship faster replies with reusable clips[/i]

[list]
[*]Save macros, links, and FAQ answers
[*]Render BBCode, Markdown, and code
[*]Sync across devices
[/list]

[quote]Best clipboard tool for power users.[/quote]

[url=https://pastecraft.com]Try PasteCraft[/url]`, 'Notes & Docs', t(10), 'bbcode'),

    clip('demo_slack', `*Hey team!* Quick launch update:

_Marketing kit is ready_ — here's what shipped:
- ~Plain text only~ → rich markup previews
- New \`Clip Viewer\` for demos & screenshots
- \`detectMarkupType()\` covers 20 formats

>>> Reminder: record the product demo before Friday standup.`, 'Work Templates', t(11), 'slack'),

    clip('demo_code_ts', `\`\`\`typescript
interface Clip {
  id: string;
  text: string;
  category: string;
  timestamp: number;
  meta?: { markupHint?: string };
}

async function syncClips(clips: Clip[]): Promise<void> {
  const { error } = await supabase
    .from('clips')
    .upsert(clips, { onConflict: 'id' });
  if (error) throw new Error(\`Sync failed: \${error.message}\`);
}
\`\`\``, 'Code Snippets', t(12), 'code'),

    clip('demo_asciidoc', `= PasteCraft Quick Start

.About
PasteCraft is a clipboard manager with built-in markup rendering.

== Install
.Chrome or Edge
[source,bash]
----
# Load unpacked from the extension/ folder
----

== Highlights
* Cloud sync across devices
* AI-powered clip analysis
* Rich formatting in Clip Viewer`, 'Notes & Docs', t(13), 'asciidoc'),

    clip('demo_rst', `PasteCraft API Overview
=======================

.. module:: pastecraft

Introduction
------------

Use PasteCraft clips as reusable snippets across your workflow.

**Bold** and *italic* work in docs you copy from Sphinx or Read the Docs.

\`\`detect_markup(text)\`\` returns the detected format.

.. warning::
   Always review sensitive clips before sharing.`, 'Notes & Docs', t(14), 'rst'),

    clip('demo_org', `#+TITLE: Launch Week Plan
#+AUTHOR: Marketing

* TODO Record product demo
** DONE Write 24 sample clips
** TODO Capture Chrome Web Store screenshots
* IN-PROGRESS Outreach list
  /Founders & ops teams/ — *personalize* each note.
  ~demo account~ ready for live walkthroughs.
* Notes
  =Key message= — clipboard that renders what you copy.`, 'Work Templates', t(15), 'orgmode'),

    clip('demo_wiki', `== PasteCraft ==

'''PasteCraft''' is a [[clipboard manager]] [[browser extension]] for Chrome and Edge.

=== Features ===

* ''Cloud synchronization'' across devices
* [[Markup language|Markup rendering]] for 20+ formats
* {{Infobox software|license=Freemium}}

=== See also ===

* [[Clipboard (computing)]]
* [[Browser extension]]

[https://pastecraft.com Official website]`, 'Notes & Docs', t(16), 'mediawiki'),

    clip('demo_jira', `h1. PC-512: Marketing demo clip pack

h2. Description

Ship 20+ prototype clips covering every markup format for store screenshots and sales demos.

* *Scope:* Empty-state seed + categories
* _Priority:_ High
* -Blocked on content- Completed

{code:javascript}
const clips = getDemoClips(Date.now());
{code}

{panel:title=Acceptance Criteria}
* All major formats represented
* Looks good in Clip Viewer
* Safe to delete anytime
{panel}

{color:green}Status: READY FOR MARKETING{color}`, 'Work Templates', t(17), 'jira'),

    clip('demo_textile', `h1. PasteCraft Design Notes

h2. Typography

p. Keep demos *clean and readable* with _clear hierarchy_.

bq. Good design is as little design as possible. — Dieter Rams

h3. Demo checklist

* Primary CTA visible
* Markup badges readable
* -Cluttered cards- removed
* +Accessible contrast+ verified

"Open brand kit":https://pastecraft.com`, 'Notes & Docs', t(18), 'textile'),

    // ── Extra code + business presets (marketing depth) ──
    clip('demo_code_py', `def rank_leads(rows):
    """Score inbound leads for the sales demo."""
    scored = []
    for row in rows:
        score = 0
        if row.get("plan") == "premium":
            score += 40
        if row.get("employees", 0) >= 50:
            score += 25
        if row.get("intent") == "high":
            score += 35
        scored.append({**row, "score": score})
    return sorted(scored, key=lambda r: r["score"], reverse=True)`, 'Code Snippets', t(19), 'code'),

    clip('demo_code_sql', `SELECT
  c.customer_name,
  s.plan,
  s.mrr,
  s.status
FROM subscriptions s
JOIN customers c ON c.id = s.customer_id
WHERE s.status = 'active'
  AND s.mrr >= 49
ORDER BY s.mrr DESC
LIMIT 25;`, 'Code Snippets', t(20), 'code'),

    clip('demo_mermaid_seq', `sequenceDiagram
    participant User
    participant Popup
    participant Sync
    participant Cloud
    User->>Popup: Copy / save clip
    Popup->>Sync: Queue write
    Sync->>Cloud: Upsert clip
    Cloud-->>Sync: OK
    Sync-->>Popup: Updated list
    Popup-->>User: Rich preview ready`, 'Diagrams & Charts', t(21), 'mermaid'),

    clip('demo_email', `Hi {{first_name}},

Thanks for checking out PasteCraft.

Teams use it to keep reusable snippets — emails, code, tables, and diagrams — ready to paste with rich previews.

Happy to walk you through a 10-minute demo this week.

Best,
{{your_name}}
PasteCraft`, 'Email Templates', t(22)),

    clip('demo_ai', `Act as a B2B product marketer for a clipboard manager.

Write a 120-word product blurb for PasteCraft that highlights:
1) auto-detected markup rendering
2) cloud sync across Chrome and Edge
3) AI Lab for summaries and breakdowns

Tone: confident, clear, no hype adjectives. End with one CTA.`, 'AI Prompts', t(23)),

    clip('demo_links', `https://pastecraft.com
https://pastecraft.com/docs
https://chrome.google.com/webstore
https://microsoftedge.microsoft.com/addons
https://github.com/trending`, 'Links & URLs', t(24)),

    clip('demo_ref', `Company: PasteCraft
Support: support@pastecraft.com
Docs: https://pastecraft.com/docs
Chrome + Edge: same extension package
Tagline: Copy anything. Paste smarter.`, 'Quick Reference', t(25)),

    clip('demo_meeting', `# Meeting Notes — Product Demo

**Attendees:** Sales, Founder, Prospect
**Goal:** Show markup rendering + sync in under 10 minutes

## Agenda
1. Empty-state clips walkthrough
2. Open Clip Viewer on Markdown + Mermaid
3. Paste a sales email template
4. Q&A / next steps

## Action items
- [ ] Send trial invite
- [ ] Share pricing one-pager
- [ ] Schedule follow-up`, 'Work Templates', t(26), 'markdown')
  ];
}

/** Merge marketing demos on top; keep non-demo user clips. */
export function mergeDemoClips(existingClips = [], demoClips = []) {
  const demoIds = new Set(demoClips.map((c) => String(c.id)));
  const userClips = (Array.isArray(existingClips) ? existingClips : []).filter((c) => {
    const id = String(c?.id ?? '');
    return !demoIds.has(id) && !id.startsWith('demo_');
  });
  return [...demoClips, ...userClips];
}

/** Merge demo categories by name; keep user-created categories. */
export function mergeDemoCategories(existingCategories = [], demoCategories = []) {
  const existing = Array.isArray(existingCategories) ? existingCategories : [];
  const byName = new Map(existing.map((c) => [String(c?.name || '').toLowerCase(), c]));
  for (const cat of demoCategories) {
    const key = String(cat?.name || '').toLowerCase();
    if (!byName.has(key)) byName.set(key, cat);
  }
  return [...byName.values()];
}
