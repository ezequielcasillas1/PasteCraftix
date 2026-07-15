### 2026-07-15 - Stripe webhook Basil period readiness
**Status:** DEPLOYED
**Files:** supabase/functions/stripe-webhook/index.ts, _shared/credit_packs.ts, credit_pricing.ts
**Result:** Deployed stripe-webhook (Basil period end + invoice id harden). verify_jwt=false. API version still 2023-10-16.

### 2026-07-15 - Settings Privacy & Data disclosure
**Status:** PENDING VERIFY
**Files:** extension/popup/features/privacy/*, popup.features.js, settings.render.js, popup.html
**Result:** Settings section lists what/why/where data goes (local, Supabase sync, Stripe, AI); versioned change notice + Got it ack; signup Terms/Privacy links point to pastecraft.com.

### 2026-05-21 - AI Refactorization History + Admin Tickets
**Status:** PARTIAL
**Files:** extension/popup/features/ai-lab/ai-lab.history.js, ai-lab.magic.js, popup.html, supabase/functions/ai-refactor/index.ts, admin/index.html, admin/admin.js, db/migrations/20260521_refactor_tickets_and_ai_history_type.sql
**Result:** Added AI Refactorization tab in conversation history with before/after view, backend diagnostics synthesis, user report ticket flow, and localhost admin Refactor Tickets tab. Needs DB migration + edge function deploy + manual smoke test.

**Status:** SUCCESS
**Files:** db/supabase-schema.sql, db/supabase-fixes.sql, extension/supabase-client.js, extension/popup.js
**Result:** Added indexed content-hash/device lookups + `get_device_diff_clips` RPC, switched popup sync panel to authoritative remote→current diff fetch, and wired realtime/device registration updates for targeted per-clip sync.

### 2026-02-20 - IndexedDB Manual Device Sync Rebuild
**Status:** PARTIAL
**Files:** extension/indexeddb-store.js, extension/popup.js, extension/popup.html, extension/supabase-client.js, db/supabase-schema.sql, db/supabase-fixes.sql
**Result:** Added IndexedDB primary entity layer + one-time migration, restored manual-only "View Available Devices to Sync" UI flow with selective import filtering, and added server-authoritative `get_effective_access_state` for DEV4EVER/owner-aware sync gating.

### 2026-02-15 - AI Summary/Breakdown Tab-Scoped Fresh State
**Status:** SUCCESS
**Files:** extension/popup.js, extension/popup.html
**Result:** AI Summary and Breakdown now refresh to empty when opening popup in a new tab or new browser session. Tab ID stored with saved state; restore only when current tab matches. Added "Open recent conversation" in empty Summary state (last 5 entries from AI History) so users can reopen without going to History tab.

### 2025-02-10 - Privacy Policy (Edge submission)
**Status:** SUCCESS
**Files:** website/privacy.html
**Result:** Replaced placeholder with full policy: info we collect (account, clips, support, payments, local/sync), use, storage (Supabase, OpenAI, Replicate, Stripe, Resend/Netlify), retention/deletion, rights, security, children, changes, contact. Last updated Feb 10, 2025.

### 2026-02-05 - Tips Widget Flicker Fix
**Status:** SUCCESS
**Files:** extension/content-script.js
**Result:** Prevented pre-settings render so the tips widget no longer flashes during page load.

### 2026-01-30 - Account-wide State Management + 3-Digit PIN (Model A/B)
**Status:** PARTIAL
**Files:** extension/popup.js, extension/popup.html, extension/content-script.js, extension/supabase-client.js
**Result:** Plan: single source-of-truth settings store + storage subscriptions so Settings/Login/Profile/Clips stay synced; PIN supports Model A (chrome.storage.sync for free) + Model B (Supabase for paid) with upgrade migration; keep “remember email” + “stay signed in” device-local; storage info is computed (not stored).

State management best practices (top 5) applied
Reusability: one “Settings Store” module and one “PIN Store” module; all UI binds to them.
Reliability: single source of truth per setting + chrome.storage.onChanged subscription everywhere + debounced cloud writes + conflict rule (updatedAt wins).
Secureness: never store passwords; PIN stored only as hash+salt; rate-limit/lockout; no logging of secrets.
Accountability: every stored preference includes updatedAt (+ optional updatedBy device id), and all writes go through one function.
Accessibility: UI always reflects real state (no stale checkbox); consistent labels; avoid hidden “magic” toggles.
Model A + Model B PIN support
Model A (free): keep current chrome.storage.sync backend for PIN.
Model B (paid): add Supabase backend (hash+salt+enabled stored keyed by user_id).
Backend selection: if user is premium, cloud is source of truth; else sync store.
Migration: on upgrade, copy sync-PIN → cloud-PIN once (if cloud missing). On downgrade, either keep last local or copy cloud → sync once (your choice).
“Reflect everywhere” subscriptions
Add storage-change reactions for:
pc_auth_prefs_v1 so login + settings checkboxes stay matched live
PIN config changes so “Require 3-digit code on open” stays consistent across all UI surfaces
Ensure content scripts update off the same canonical keys (stop having multiple keys for the same concept).

Recommended checkbox behavior (what should be cross-synced vs local)
Cross-synced (account-wide; good candidates)
“Require 3-digit code on open” (pin enabled)
Paid (Model B): sync via Supabase (always cross-device).
Free (Model A): sync via chrome.storage.sync (cross-device only if browser sync enabled).
“Remember this login with a 3-digit code” (sign-in onboarding preference)
Store as account-level preference: “this account prefers PIN lock”.
Behavior: after sign-in on any device, if preference is on and no PIN exists, prompt setup.
Local-only (should NOT be account-wide)
“Remember email on this device”
Keep local-only for privacy; syncing it across devices is surprising.
“Stay signed in on this browser”
Keep local-only: it’s about this device’s session persistence, not the account.
“Storage information”
Should not be a checkbox or stored preference. It should be computed from synced data (clips/categories/archive) and therefore naturally “account-wide”.

### 2026-02-04 - Auto-Copy Clip Save Path Guard
**Status:** SUCCESS
**Files:** extension/background.js, extension/content-script.js, extension/popup.js
**Result:** Added missing array normalization in background save flow so auto-copy persists; verification complete. (Commit: pending)

### 2026-02-04 - 3-Digit Passcode Enhancement
**Status:** SUCCESS  
**Files:** extension/popup.js, extension/popup.html  
**Result:** Fixed PIN persistence bug (sets currentUser before PIN save), added unlimited session toggle, updated sign-in checkbox text to match settings, synced checkbox states across UI, confirm modals already present.