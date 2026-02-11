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

