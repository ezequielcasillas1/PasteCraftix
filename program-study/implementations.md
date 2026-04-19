### Jan 4, 2026 - Support Forms + Account Settings
**Status:** SUCCESS
**Files:** popup.html, popup.js, netlify/functions/support-ticket.js, website/account.html
**Result:** Added popup support forms that auto-send via Netlify/Resend; added account password reset + email preferences toggle.

### Feb 11, 2026 - Session Persistence Across All PC Features
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Persists active tab, AI Lab sub-tab, AI Breakdown (input/level/cache/threads), AI Summary (input/questions/result/threads) to chrome.storage.local. Restored on popup init. Content survives popup close, exit, and sign-out.

### Feb 11, 2026 - AI Output Minimal Formatting + Quick Save Markup Support
**Status:** SUCCESS
**Files:** supabase/functions/ai-summary/index.ts, supabase/functions/ai-breakdown/index.ts, extension/popup.js, extension/popup.html, extension/styles.css, extension/markup-renderer.js
**Result:** AI Summary/Breakdown prompts now enforce plain-text formatting: no //, \\, *, no LaTeX/math markup, step-based clarity. _formatAiOutput() strips residual markdown/LaTeX from responses. Quick Save now has markup type dropdown (19 languages + auto-detect), stores markupHint in clip.meta, and detectMarkupType() prioritizes it.

### Feb 11, 2026 - PC 1.0 Preset Example Data (Clips, Categories, Notes)
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Replaced 12 demo clips + 5 string categories + 8 notes/albums with 4 curated examples each. Clips showcase LaTeX, Mermaid diagram, JavaScript code, and Markdown with proper markupHint meta. Categories are now proper objects with id/name/icon/timestamps. Notes mirror the 4 clip types. All labeled [Example] with delete instructions.

### Feb 11, 2026 - AI Workflow Immediate Reflect on Provider/Model Change
**Status:** SUCCESS
**Files:** extension/supabase-client.js, extension/popup.js
**Result:** Added `setAiWorkflowConfigDirect()` to PasteCraftSupabase to bypass 5s storage cache. Popup now syncs in-memory cache immediately on provider/preset change. Also clears stale breakdownCache when model switches so AI Summary & Breakdown always use the currently selected provider/model.

### Feb 11, 2026 - AI Rich Markup Rendering (LaTeX, Diagrams, Tables)
**Status:** SUCCESS
**Files:** ai-summary/index.ts, ai-breakdown/index.ts, popup.js, popup.html, markup-renderer.js
**Result:** AI prompts now instruct models to use Markdown, LaTeX ($/$$ notation), Mermaid diagrams, and tables. New `_renderAiResponse()` method in popup.js uses PCMarkup renderer to parse and display rich content with KaTeX math, Mermaid SVGs, syntax-highlighted code blocks, and styled tables. All 19 markup types supported in AI output.

### Feb 11, 2026 - AI History Tab (Persistent Conversation Logs)
**Status:** SUCCESS
**Files:** popup.html, popup.js
**Result:** New "AI History" tab next to Notes. Auto-saves all Summary/Breakdown conversations with full threads to chrome.storage.local. OpenAI generates titles async. History viewer modal with numbered pagination, rich rendered content, and copy button. Supports delete individual + clear all.

### Feb 12, 2026 - PDF Text Extraction to Clips
**Status:** SUCCESS
**Files:** popup.html, popup.js, styles.css, manifest.json, lib/pdf.min.js, lib/pdf.worker.min.js
**Result:** Added PDF upload button in Quick Save section. Uses pdf.js v3.11.174 to extract text from uploaded PDFs. Preview modal shows page tabs, extracted text, save-as-single or per-page clip options with category selection. Clips saved with source:pdf meta tag.

### Feb 12, 2026 - AI History: Edit Title & Continue Conversation
**Status:** SUCCESS
**Files:** popup.html, popup.js, styles.css
**Result:** Added edit title button (pencil icon) in AI history modal header with inline input, save/cancel. Added "Continue Conversation" button that restores full thread state and navigates to AI Lab summary or breakdown tab with follow-up ready.

### Feb 12, 2026 - PDF Extract: Save Selected Page Option
**Status:** SUCCESS
**Files:** popup.html, popup.js, styles.css
**Result:** Added 3rd radio option "Save selected page" in PDF extraction modal. Clicking a page tab (P1–Pn) auto-selects this mode. Save button label updates to show selected page number. Validates a specific page is chosen before saving.

### Feb 12, 2026 - Album Picker: Remove Redundant Create Note & Persist Modal
**Status:** SUCCESS
**Files:** popup.html, popup.js
**Result:** Removed redundant "Create New Note" button from Send to Note/Album picker. Album picker now stays open after creating a new album—new album appears at top of list via createdFromPicker flag re-opening the picker post-save.

### Feb 12, 2026 - Weighted AI Text Credits System (Multi-Model)
**Status:** SUCCESS
**Files:** ai_workflow.ts, stripe-webhook/index.ts, ai-breakdown/index.ts, ai-summary/index.ts, ai-hint/index.ts, ai-vision/index.ts, ai-trends/index.ts, popup.js, popup.html
**Result:** Replaced flat 1-credit-per-call system with weighted credits based on real API pricing. Cheap models cost 25 cr, default 40 cr, mid-tier 100–200 cr, premium 350–500 cr. Scaled pools 40× (weekly 4K, monthly 10K, yearly 100K). Added legacy limit migration, dynamic tooltip showing per-model costs by provider, and credit cost labels on preset dropdowns.

### Feb 12, 2026 - AI Smart Categorization (Magic Wand)
**Status:** SUCCESS
**Files:** ai-categorize/index.ts, supabase-client.js, popup.js
**Result:** Added AI-powered smart categorization to Magic Wand. Premium users get batch AI categorization via cheapest model (gpt-5-nano, 25 credits). AI generates minimal, reusable 1-3 word category titles. Falls back to rule-based categorization for free/basic users or on AI failure.

### Feb 12, 2026 - AI Smart Format (Magic Wand)
**Status:** SUCCESS
**Files:** ai-format/index.ts, supabase-client.js, popup.js, popup.html, styles.css
**Result:** Added AI grammar/punctuation polish to Magic Wand. Fixes grammar, punctuation, capitalization without changing vocabulary or meaning. Skips code/URL/data clips. 25 credits per batch. Credit notice shown in preview modal and info modal for premium users. Results modal shows AI Formatted count.

### Feb 12, 2026 - Magic Wand Pipeline Fix (AI + Cleanup + Dupes)
**Status:** SUCCESS
**Files:** popup.js
**Result:** Fixed 3 conflicts: (1) AI Format now runs as pipeline with Content Cleanup instead of either/or — cleanup always runs after AI polish. (2) Duplicate detection rebuilt after all text modifications for accurate post-cleanup matching. (3) Preview tags show both "Smart Format (AI)" and "Needs cleanup" independently when both apply.

### Feb 12, 2026 - Production Presets: Categories, Clips, Notes & Albums
**Status:** SUCCESS
**Files:** popup.js
**Result:** Updated demo seed for Edge marketplace release. 8 research-backed preset categories (Code Snippets, Links & URLs, Email Templates, AI Prompts, Quick Reference, Math & Formulas, Diagrams & Charts, Notes & Docs). 8 sample clips (4 markup demos: LaTeX, Mermaid, JS, Markdown + 4 common clipboard: URLs, email template, AI prompt, reference info). Notes seed updated to 2 notes + 2 albums (Welcome guide, Meeting template, Developer Toolkit album, Research & References album).

### Feb 12, 2026 - Skip to PasteCraft (Freemium Guest Mode)
**Status:** SUCCESS
**Files:** popup.html, popup.js, styles.css
**Result:** Added "Skip to PasteCraft" button on login screen for freemium use without account. Guest state persists via chrome.storage.local. Email contact/support forms show account-required notice with "Create Free Account" button redirecting to sign-up. Guest flag clears on sign-in/sign-out.

### Apr 19, 2026 - Clips Page Bulk AI Actions Bar
**Status:** PENDING_VERIFICATION
**Files:** popup.html, popup.js
**Result:** Added 4-button bulk AI actions bar beneath "Delete Selected" on Clips page. Bar appears only when 2+ clips are selected. Buttons: AI Summary, Send to Categories, Send to Notes, AI Breakdown. Each combines selected clip texts (newline-separated) and routes into existing modals/flows via `showSummaryModal()`, `showBreakdownModal()`, `showCategoryModal()`, `showAlbumPicker()`. State managed via extended `updateQuickCopyButton()` + new `_getSelectedClipsText()` helper.

