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