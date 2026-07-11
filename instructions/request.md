# PasteCraft - Future Feature Requests

**Last Updated:** July 9, 2026  
**MVP Status:** ✅ COMPLETE AND DEPLOYED

**Note:** All completed implementations are logged in `program-study/Completed/Implementations.md`

---

## 📋 **FUTURE ENHANCEMENTS (Post-MVP)**

---

#### 1. Authorization & Subscription Enforcement
**Priority:** HIGH (Required for monetization)  
**Status:** Deferred (implement after Stripe tiers are configured)  

**Subscription Tiers:**
- **FREE:** Unlimited clips via local storage (no cloud sync), no AI
- **BASIC:** Cloud sync (no AI)
- **PREMIUM:** Cloud sync + AI features (Breakdown/Summary/Image) + backup/restore

**Requirements:**
- Blocked by **#2** (Stripe tier configuration + price → tier mapping)
- Enforce cloud sync entitlements server-side (FREE local-only; BASIC/PREMIUM allowed)
- Keep AI premium gating + subscription validation (already exists)
- Add grace period handling for expired/past_due subscriptions

Dont write md files explaining steps 1 and 2. just guide me via chat


--- 

#### 2. Stripe Tier Subscription Sync (FREE / BASIC / PREMIUM)
**Priority:** HIGH (Required for monetization)  
**Status:** Next up  

**Requirements:**
- Update Stripe → DB sync to support **FREE / BASIC / PREMIUM** tiers (unblocks **#1**)
- Map Stripe Price IDs → tier + features; persist tier on webhook events
- Authenticate premium-gated endpoints (sync + AI) and enforce entitlements server-side
- End-to-end test: upgrade/downgrade/cancel → webhook → tier update → feature gating

---

#### 3. Subscription Description (Website + Upgrade Page)
**Priority:** HIGH  
**Status:** ✅ Completed  

---

#### 4. Home Page SEO Target / Landing Page Adjustments
**Priority:** HIGH  
**Status:** Coming soon  

**Requirements:**
- Improve homepage SEO (meta/title/description/keywords + schema)
- Landing page headline/hero/CTA conversion adjustments
- Performance + mobile-first checks

---

#### 5. Batch Copy Process (Top-Right Mainframe Widget)
**Priority:** Medium  
**Status:** Not started  

**Requirements:**
- Add a **top-right mainframe widget** (fixed) with 3 icons stacked **above** the main widget: **Batch Copy**, **Add to Copy**, **Image → Text**
- Styling: top-right icons + cursor bar should **match the main widget style** (colors, rounded edges, glow, spacing, tooltips)
- Batch icon: **green = ON**, **black = OFF** (like auto-copy)
- When ON: sequential copies append into **one** batch clip (delimiter-based)
- On copy: show fingernail-size rectangular bar near cursor (right side), **50% transparent blue**
- If user dismisses the top-right indicator, it reappears near cursor on next copy (while still ON)

---

#### 6. Add to Copy (Top-Right Mainframe Widget + Search Catalog)
**Priority:** Medium  
**Status:** Not started  

**Requirements:**
- Add-to-Copy icon lives in the **top-right mainframe widget**
- On copy: system automatically captures **ONLY the most recent copy** (refreshes each new copy)
- Cursor bar: clickable **“Add to Copy”** button (50% transparent blue bar, right of cursor)
- Opens compact card-sized search catalog (same sort/filter behavior as Search tab)
- Multi-select clips to append to the **current (most recent) copy** or active batch (delimiter-based)

---

#### 7. Widget Icon = Profile / Gallery Image
**Priority:** Medium  
**Status:** Not started  

**Requirements:**
- Replace the PasteCraft logo **on the main widget icon** with the user's **profile-made image** (profile image or selected Images → Gallery image)
- Preferences: add button under Dark Mode: "Set profile image to widget icon" (rectangular)
- Images → Gallery: per-image widget-icon button with tooltip: "Set as widget icon"
- Persist setting in storage; fallback to default logo if image fails

---

#### 8. Analytics & Usage Tracking
**Priority:** Low  
**Requirements:**
- Track metrics: clips created, images generated, active users, retention
- Privacy-conscious (no personally identifiable information)
- User can opt-out via settings


---

#### 9. Images Page (Image → Text + Image Copy + Gallery)
**Priority:** Medium  
**Requirements:**
- Add new **Images** page/tab (replaces AI Lab Gallery page + removes AI Image Generator)
- Images page includes: **Image → Text analyzer**, **Image Copy library**, **Gallery**
- Gallery shows images created by AI via the **Profile popup module**
- Gallery supports **download** (PNG/JPEG) + filename with timestamp/prompt reference


---

#### 11. Export/Import Functionality
**Priority:** Low  
**Requirements:**
- Export all clips to JSON/CSV
- Import clips from other sources
- Full backup of PasteCraft data

---

#### 12. Collaboration Features
**Priority:** Low (Post-MVP v2.0)  
**Requirements:**
- Share clips with other users
- Team workspaces
- Shared categories

---

#### 13. Browser Extension - Cross-Browser Support
**Status:** Partial (Edge only)  
**Priority:** Medium  
**Description:**
- Currently optimized for Microsoft Edge
- Add Chrome Web Store support
- Test Firefox compatibility


---

#### 14. Auto-Copy on Clip Click (Settings Option) {this is done after all copy and delete buttons have been implemented}
**Priority:** Medium  
**Requirements:**
- Add settings toggle: "Enable auto-copy on clip click"
- **When Enabled:** User can copy clips by simply clicking them (no copy button needed)
  - Single click on clip automatically copies to clipboard
  - Multi-select: clicking multiple clips accumulates them (space-separated) into clipboard
  - Works across all pages (clips page, search results, categories)
  - Hide/disable all copy buttons (quick copy button on search page, category folder copy button)
  - Categories: Show only delete button (not `copy | delete`, just `delete` button in full)
- **When Disabled:** User must manually click copy button to copy clips
  - Show all copy buttons as normal (`copy | delete` format for categories)
- Preference persists across sessions

---

#### 15. Persistent Popup & Quick View (Stay-Open Behavior)
**Priority:** High  
**Requirements:**
- **Main Popup Issue:** Popup closes when user clicks on website or navigates to different tab/page
- **Quick View Issue:** Quick View menu closes/loses position when user interacts with page or switches tabs
- **Solution:** Both should remain open and maintain state during website interaction and tab navigation
- **Settings Control:** Add two toggles in settings:
  - "Keep popup open when clicking on pages" (main application)
  - "Keep quick view open when clicking on pages" (quick view menu)
- **Default:** Enabled (stays open when user navigates between pages and clicks things on website)
- When disabled: Returns to current behavior (closes on outside click/navigation)

---

#### 16. AI Knowledge Base & Clipboard Journey Analyzer
**Priority:** Medium  
**Status:** Future Enhancement  
**Requirements:**
- **AI-Powered Analysis Bot:** Intelligent system that analyzes user's entire clipboard history
- **Scope of Analysis:**
  - All clips (singles, batches, categories)
  - Usage patterns over time
  - Most copied content types
  - Category distribution
  - Temporal patterns (when user copies most)
- **Knowledge Base Creation:**
  - AI summarizes user's clipboard journey
  - Identifies themes and topics from clipboard history
  - Creates personalized insights dashboard
  - Tracks what user copies most frequently
- **User Dashboard Integration:**
  - Display on pastecraft.com/account page
  - Show AI-generated summary of clipboard usage
  - Visualize patterns (charts, graphs, word clouds)
  - "Your Clipboard Story" narrative
- **Smart Features:**
  - Discover content patterns user might not notice
  - Suggest optimal categories based on usage
  - Predict what user might need based on history
  - Create "memory timeline" of clipboard activity
- **Privacy Considerations:**
  - User opt-in/opt-out setting
  - Local processing option
  - Clear data retention policies
  - Transparent about what AI analyzes
- **Implementation Notes:**
  - Integrate with existing clip storage in Supabase
  - Use OpenAI for natural language analysis
  - Real-time updates as user copies new content
  - Export knowledge base as PDF/report

---

#### 17. Freemium Tier Display on Pricing Page
**Priority:** High  
**Status:** Needs Update  
**Requirements:**
- Update Free tier card: **Unlimited clips (local storage only)**
- Show: ❌ No cloud sync, ❌ No AI
- Add copy line: “Clips stay on your device”


---

#### 18. Unsubscribe Portal Routing (pastecraft.com)
**Priority:** Medium  
**Status:** Not started  
**Requirements:**
- Unsubscribe portal should redirect to `pastecraft.com` unsubscribe form (if it exists)
- If no dedicated form exists, route user to a PasteCraft unsubscribe routed page (e.g. `/unsubscribe`)
- Ensure all unsubscribe links (emails/portal) use the same destination

---

#### 20. Right-Side Widget UI Polish (Transparency + Tight Fit)
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Widget background **50% transparent**
- Background/container should tightly fit buttons (no extra padding)
- Button outer edges flush with background edges

---

#### 21. Image-to-Text Analyzer (Snipping Tool OCR → Clip)
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Lives in a **full-width white top strip** (about ~1cm height, not bulky) that pushes page content down
- Top strip includes **Spot + Image Picker** (single clean bar at top of webpage)
- Snipping-tool style: click + drag to capture region; extract text into **editable/formable text**
- Save result as a clip showing **image + extracted text** (Clips page is the main feed)
- Hybrid OCR: **local OCR** → if mismatch, prompt “does the text match?” → retry local → **AI/vision OCR fallback on first redo**
- Optional: preview before saving; popup/module supports manual Image → Text (upload or paste image)

---

#### 22. 3-Digit Passcode Login & Session Management
**Priority:** Medium  
**Status:** Partial (Needs multi-device + sync reliability fixes)  
**Requirements:**
- Opt-in “Remember login with 3-digit code” on Sign In
- Require PIN to unlock the extension UI on open (keep Supabase session; don’t store passwords)
- Ensure Supabase login/session is recognized across multiple computers (sync ops work seamlessly after sign-in)
- PIN unlock works across devices via browser sync storage (same account, same PIN hash)
**Setup & Authentication:**
- Opt-in checkbox on Sign In: "Remember future sessions with 3 digit passcode"
- Require PIN to unlock the extension UI on open (keep Supabase session; don't store passwords)
- Ensure Supabase login/session is recognized across multiple computers (sync ops work seamlessly after sign-in)
- PIN unlock works across devices via browser sync storage (same account, same PIN hash)

**Session Cache Behavior:**
- 3-digit login acts as one-time during browser session (no re-prompt until session ends)
- After browser session ends, 3-digit login commences again on next session (unless "Unlimited session" enabled)

**Settings Controls:**
- "Require a 3 digit passcode when starting a new session" (default: enabled)
- "Unlimited session" toggle (persists across browser restarts, no 3-digit login on reopen)
- Login checkbox state reflects Settings state (single source of truth)
- Enable/disable passcode + change/reset code options
- Add lockout on repeated PIN failures

**Bug Fixes:**
- After setting a 3-digit PIN during sign-in, the extension later reports no PIN exists and prompts to create it again.
- “Require 3-digit code on open” checkbox is unreliable (doesn’t consistently enforce lock/unlock on open)
- “Change 3-digit code” and “Disable code” actions do not reliably apply/persist; review state/storage flow
- Add confirm modal for **Disable code** (are you sure?)
- Add confirm modal for **Change 3-digit code** (confirm new PIN / confirm changes)

---

#### 23. Quick Paste Settings Cleanup (Remove Theme)
**Priority:** Low  
**Status:** Coming soon  
**Requirements:**
- Remove Quick Paste “Theme” setting (redundant with global Dark Mode)
- Quick Paste UI should follow the global theme from Profile/Settings (single source of truth):
making sure that settings and profile have a dark mode setting, in which if one turns on the other in settings has to match which is called
state management.
- Keep only behavior settings here (auto-hide, timestamps, max clips)

---

#### 24. Image Copy Options (Image / URL / Both)
**Priority:** Medium  
**Status:** Coming soon  
**Requirements:**
- Add a third right-click option: **Copy both (Image + URL)**
- Ensure “Copy Image” → image clip only, “Copy Image Link” → URL clip only, “Copy both” → saves both clip types

---

#### 25. Math Clip Rendering (LaTeX/MathML) - DONE
**Priority:** Medium  
**Status:** Coming soon  
**Requirements:**
- Math copies may arrive as **plain text**, **HTML** (MathML/KaTeX/MathJax), or **image** depending on source
- When available, store/use the copied `text/html` payload for rendering (fallback to plain text)
- Develop support for Math markup formats (MathML/KaTeX/MathJax) so math renders comfortably with high-quality output in Clips
- Render math safely in Clips viewer (best effort) and never break normal text clips

---

#### 26. URL Link Clips (Clickable + Redeemable)
**Priority:** Medium  
**Status:** Not started  
**Requirements:**
- Support saving copied **URL links** as clips (same as text clips)
- URLs display in **Clips**, **Search**, and **Categories** aka treat it like a regular clip
- URLs are **clickable/redeemable**: click opens the link in a new tab
- Support sending URL clips to **Notes** (album/note attachment)


---

#### 27. Zero-Loss Sync + Durable Storage
**Priority:** High  
**Status:** In progress  
**Requirements:**
- Soft-delete + audit log for clips/categories/notes (no hard deletes)
- Notes + attachments sync to Supabase with history snapshots
- Device sync state + conflict merge by updatedAt
- Tombstones for cross-device deletion consistency

---

#### 28. Restore Merge Mode (No Overwrite)
**Priority:** High  
**Status:** In progress  
**Requirements:**
- Restore should merge snapshot/backup into current data
- Deduplicate by content/id; newest wins on conflicts
- Applies to local restore, sync backup restore, and cloud restore
- Keep settings/profile from current device unless missing

---

#### 29. Spot (Field Detection Widget + Preset Lists)
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Popup/module “Spot” page: preset categories (Tags, Address) + CRUD lists inside each category
- On-page Spot UI lives in the **full-width white top strip** (~1cm height) that pushes page content down
- Spot turns green when matching fields exist on page; shows menu items for detected category
- Settings: matcher checkboxes (visible match default, focus match, manual scan gate, strict autocomplete) + actions (preview, fill, copy, batch fill, batch copy/join)
- Per-item binding: clip joiner + clip settings preset (delimiter + dedupe/sort/uppercase)
- Only user-initiated actions; never auto-fill without explicit click/confirm

---

#### 30. Copy Filter Presets (Apply + Copy)
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Presets transform selected/page text then copy result (dedupe/sort/case/delimiter + future rules)
- Entry points: popup button, on-page widget button, context-menu option
- Prefer highlighted selection; fallback to best-effort page extraction when no selection
- Optional preview/confirm toggle

---

#### 31. Copy Attempt Indicator + AI Copy Signal
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Detect copy attempts (Ctrl+C/context menu/PasteCraft copy actions) and show indicator: Copied / Not copied
- “Copied” is true if clipboard updated OR PasteCraft clip saved (either)
- Optional AI hints: “needed/recommended to copy?” + up to 3 tips (premium-only), non-blocking UI
- Privacy guardrails: cap text length + include pageUrl only

---

#### 32. Markup Language Support (Comprehensive Formattable Text)
**Priority:** High  
**Status:** Implemented  
**Requirements:**
- Detect & render copied markup in Clips, Search, Categories, and Notes (never break plain text)
- **Document markup:** Markdown/CommonMark, GFM (tables/task lists/strikethrough), HTML (sanitized), AsciiDoc, reStructuredText, Org-mode, Textile, RTF
- **Wiki/team markup:** BBCode, MediaWiki, Creole, JIRA/Confluence, Slack/Discord formatting
- **Diagram markup:** Mermaid, PlantUML, Graphviz/DOT (render as inline SVG/image)
- **Structured data:** JSON, YAML, TOML, XML, CSV/TSV (syntax-highlighted, collapsible)
- **Code blocks:** Syntax-highlighted code for common languages (auto-detect or fenced block lang tag)
- **Math:** Handled by Feature #25 (LaTeX/MathML/KaTeX/MathJax) — already done
- Store/use copied `text/html` when available; fallback to plain text detection/heuristics
- "View raw" toggle per clip for any markup payload; user can switch between rendered ↔ source
- Best-effort approach: unknown/ambiguous markup renders as plain text (no errors)

---

#### 33. Mini UI Polish (Tips Widget + Scrollbars + Icons)
**Priority:** Low  
**Status:** Not started  
**Requirements:**
- Popup/module scrollbar uses PasteCraft **primary sky-blue** (consistent theme)
- Notes/custom icons: make **custom icons match standard icon sizing + weight** (Windows/Edge preset icons)
- Clips navbar: remove the subtle shaded background fill behind the search (magnifying glass) area

---

#### 34. AI Output Formatting Mode (Summaries + Breakdowns)
**Priority:** Low  
**Status:** Not started  
**Requirements:**
- Improve formatting consistency for summaries/breakdowns (headings, spacing, readable structure)
- Add optional **step mode** toggle (numbered steps) for AI Summary + AI Breakdown
- Avoid unnecessary code-style prefixes (e.g. leading `//`) when not needed

---

#### 35. Funky Animal Name Save/Render Fix
**Priority:** Low  
**Status:** Not started  
**Requirements:**
- Ensure renamed “funky animal name” **persists and renders consistently** across the PasteCraft UI
- Ensure related UI copy/labels that reference the name stay consistent across sessions

---

#### 36. Note Card Icon Alignment
**Priority:** Low  
**Status:** Not started  
**Requirements:**
- Fix vertical alignment for note card action icons (edit/delete/export/etc.) so spacing/positioning is consistent

---

#### 38. PDF Text Extraction to Clips
**Priority:** Medium  
**Status:** Completed  
**Requirements:**
- Upload PDF via popup Quick Save section
- Extract text using pdf.js (page-by-page)
- Preview extracted text with page tabs
- Save as single clip or one clip per page
- Category selection + source:pdf meta tag

---

#### 39. Activity Log History UI
**Priority:** Medium  
**Status:** In progress  
**Requirements:**
- Add "Activity History" page/tab showing user's audit logs from `change_audit_log`
- Display: action type, table affected, timestamp, summary of change
- Filter by date range, action type (INSERT/UPDATE/DELETE)
- Paginated list with newest first
- RLS policy ensures users see only their own logs (Option A implemented)

---

#### 40. Password Validation UI (Match Supabase Settings)
**Priority:** High  
**Status:** In progress  
**Requirements:**
- **Min 8 characters** - show real-time character count indicator
- **Complexity rules** - require: lowercase, uppercase, digit, symbol
- **Visual feedback** - checkmarks/x for each requirement as user types
- **Strength meter** - color-coded bar (red/yellow/green)
- **Apply to:** Sign Up form, Change Password form, Reset Password form
- **OTP display** - 6-digit input field with 1-hour expiry note

---

#### 42. Admin Dashboard (Security + User Management)
**Priority:** High
**Status:** Not started — builds on auto-ban system (implemented Apr 2026)

**Requirements:**
- Protected page (admin_users table gates access via service role Edge Function)
- **Users list:** email, tier, is_banned, warning_count, created_at, last_seen, clip count
- **Security events feed:** event_type, severity, triggered_at, details, resolved status — filter by user, type, date
- **Per-user panel:** view profile stats (no clipboard data), subscription info, security event history
- **Actions:** ban (temp/permanent + reason), unban, adjust clip limit override, send warning email, delete account
- **Rate limit violations log:** who hit limits, how often, on which tables
- No access to user clipboard content, notes body, or personal data

---

#### 41. Clip Rate Limiting + Admin Spam Control
**Priority:** High  
**Status:** Not started  
**Requirements:**
- **Rate limit:** Block inserts at 700 clips/day per user, resets after 24 hours
- **Admin "Spammy Injection" section:** Show users who hit/exceeded limit
- **Admin actions:** Ban user, delete user, send warning email
- **Limit bypass:** Input field "Increase clip limit by ____" for trusted users
- **DB trigger:** `check_clip_insert_limit()` with configurable per-user override column

---

#### 43. Website - Futures Page
**Priority:** Medium  
**Status:** Not started  
**Requirements:**
- Create `/futures` page on pastecraft.com
- Display upcoming features and roadmap
- Show feature voting/interest indicators
- Link from main navigation

---

#### 44. Website - Documentation Page
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Create `/docs` page on pastecraft.com
- Comprehensive guide on how to use PasteCraft
- Sections: Getting Started, Features, Hotkeys, Settings, FAQ
- Mobile-friendly layout with search

---

#### 46. Icon Click Hit-Target Fix (Post-Refactor)
**Priority:** High
**Status:** Queued — implement after modular refactor is complete
**Implement After:** Clips-first modular refactor (clips.events.js, categories.events.js, widget events)

**Problem:** Clicking the icon portion of any button does not trigger the action; only clicking the label text works.

**Root Cause Pattern:**
- Event listeners attached to the text node / inner span rather than the full button container
- OR icon SVG/img element intercepts pointer events and the click never reaches the handler

**Requirements:**
- Add `pointer-events: none` to all icon elements (`svg`, `img`, `i`, `.icon`) inside action buttons — lets clicks pass through to the button
- Ensure all button event handlers are registered on the outermost button/container element, not on inner children
- Apply fix across all affected surfaces: Popup (Quick Save PDF button, Save Clip button), content widget (Magic wand button), and any other button that contains an icon + label pair
- Validate fix in `*.events.js` modules during/after refactor extraction — do not patch the monolith `popup.js` just to move it again
- After fix: clicking anywhere on a button (icon or label) must trigger the same action

---

#### 47. Craft Clips AI Rebuild (Magic Wand revamp)
**Priority:** High
**Status:** In progress — ships as **Craft Clips** (`ai-lab.magic.js`, settings in `ai-lab.craft-clips.*`)
**Requirements:**
- Rebrand UI/copy: Magic Wand → **Craft Clips**; **action cards** per clip (categorize, format/refactor, cleanup, dedupe)
- **Smart categorize** toggle: premium → 5 AI title picker modal after craft, then apply; else rules; `createCategory` CRUD
- **AI modes (one per craft):** **AI Formatted** (`ai-format`, polishes `text`) *or* **AI Refactoring** (`ai-refactor`, levels ELI5–Wise Man, keeps original clip + adds new refactored clip in recents)
- **Settings:** categorize on/off, archive-duplicates on/off, refactor level chips with ⓘ tooltips
- **Duplicates:** archive younger copies to `searchOnlyClips` when toggle on; undo restores clips + archived
- **Storage:** `pc_craft_clips_settings_v1`; refactor fields local on clip; sync archived on craft
- Plan: `docs/refactoring/craft-clips-ai-implementation-plan.md`

---

#### 45. Comprehensive Hotkey System
**Priority:** High  
**Status:** Not started  
**Requirements:**
- Define and implement keyboard shortcuts for core features
- Add hotkey configuration in Settings
- Display hotkey hints in UI tooltips

**Proposed Hotkeys (5-10):**
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Open Quick View panel |
| `Ctrl+Shift+C` | Copy selected clip to clipboard |
| `Ctrl+Shift+S` | Quick save current selection as clip |
| `Ctrl+Shift+F` | Open search in Quick View |
| `Escape` | Close Quick View / Cancel action |
| `Ctrl+Shift+N` | Create new note |
| `Ctrl+Shift+A` | Toggle AI Summary on selected text |
| `↑ / ↓` | Navigate clips in Quick View |
| `Enter` | Select/copy highlighted clip |

- Register shortcuts in `manifest.json` using `commands` API
- Allow users to customize shortcuts in Settings
- Show hotkey reference card in Documentation page

---

#### 48. Activity Log — Deleted Item Recovery
**Priority:** Medium
**Status:** Not started — depends on Activity Log refactor (done)

**Requirements:**
- On the Activity Log tab, any DELETE row shows a "Recover" button
- Recovery window: **7 days max** — entries older than 7 days show Recover button as grayed/hidden
- Works fully offline — no Supabase dependency for the recovery read path
- After recovery, show toast and refresh the relevant feature list

**Storage decision — IndexedDB + `navigator.storage.persist()`:**
- `chrome.storage.local` is a 10MB hard cap — too small; already used by clips/notes/settings
- Supabase `change_audit_log` cannot be the source of truth: FREE tier has no cloud sync, offline kills recovery, and sync must have already run before the delete is logged
- IndexedDB has no hard extension cap but is evictable by browser under disk pressure
- Fix: call `navigator.storage.persist()` at install/startup — browser marks the origin as persistent and **cannot silently evict it** (must prompt user first). PasteCraft already uses IndexedDB, so no new infrastructure needed.

**Implementation notes:**
- On every delete (clip, note, category, archived clip) — write full item snapshot to IndexedDB `deleted_items` store with `{ item, table_name, deleted_at }`
- Prune entries older than 7 days on each write (keeps store bounded)
- Hard cap: 200 items max as a safety valve
- `activity.service.js`: add `recoverDeletedEntry(entry)` — reads from IndexedDB, re-inserts locally, queues Supabase upsert via existing `syncQueue` if online
- Call `navigator.storage.persist()` in `background.js` `onInstalled` handler

---

#### 49. Multi-Provider AI Keys (Gemini, Anthropic, Grok)
**Priority:** Medium  
**Status:** Coming soon — OpenAI only for MVP  

**Requirements:**
- Supabase Edge Function secrets: `GOOGLE_AI_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY` (user-provided)
- Re-enable AI Lab provider dropdown options when each key is set
- Server `ai_workflow.ts` already has Gemini routing; add Anthropic/Grok resolvers when keys land
- Migrate any stored `provider: google` prefs back to `openai` until launch

---

## Account Dashboard (Website — `/account`)

Logged-in user area on pastecraft.com (not Admin Dashboard **#42** or local admin-api).

#### 50. User Security Dashboard
**Priority:** Medium  
**Status:** Not started  

**Requirements:**
- New **Security** panel/section on `pastecraft.com/account` (signed-in dashboard only)
- **Account standing:** Read own `user_profiles` — show `is_banned`, `ban_reason`, `ban_expires_at`, `quarantine_paused_until` when set
- **Devices:** List own `pastecraft_devices` (display name, `last_seen_at`); full Auth session revoke is follow-up — not in v1 unless Supabase session API is wired
- **Usage guardrails:** Today’s clip count vs `daily_clip_limit` (warn near limit); do not expose admin-only `rate_limit_violations` rows
- **Protection summary:** Extension link-safety read-only (site-guard blocklist last sync / `pastecraft.com/safety/blocklist.json` updated-at); count of clips with `expires_at` (auto-expire)
- **Activity link:** Cross-link to Activity History (**#39**); user-facing `security_events` feed needs scoped RLS or user Edge Function (table is admin-only today)

---

#### 51. AI Credit Pack Purchases (Stripe One-Time)
**Priority:** High  
**Status:** Scaffolding in progress  

**Requirements:**
- Unified purchased credit pool (`ai_purchased_credits_balance`) — works for text (weighted) and image (1:1)
- Stripe one-time packs: **1,000 credits / $5**, **5,000 credits / $15**
- Custom credits: min **25** input; tiered price from credits (25–999 @ $0.005, 5000+ @ $0.003)
- Stripe Checkout `price_data` for custom; server calculates cents from credit count
- Checkout floor **100 credits ($0.50)** — Stripe minimum; UI previews sub-min amounts
- Webhook fulfills via `credit_purchases` audit + balance increment
- Premium required to buy or spend purchased credits

---

#### 52. AI Lab Buy-Credits Banner
**Priority:** High  
**Status:** Scaffolding in progress  

**Requirements:**
- Banner in AI Lab header area: “Want to buy more credits?” with pack buttons
- Show when total remaining credits ≤ 500 (text + image + purchased)
- Checkout via existing background `pcCreateCheckout` message (`mode: payment`)
- Follow-up: same banner on website `/account` and popup widget header

---

#### 53. Real-Time Announcements System
**Priority:** Medium  
**Status:** Scaffolding in progress  

**Requirements:**
- Supabase `app_announcements` table (title, body, link, audience, active window, priority)
- Edge Function `get-announcements` returns active rows for extension + website
- AI Lab banner stack: announcements above buy-credits banner; dismiss persists locally
- Admin authoring UI deferred — seed rows via Supabase dashboard for now

---

#### 54. Increase Craft Power (Regular ⟷ Super)
**Priority:** Medium
**Status:** Implemented
**Requirements:**
- Two-mode toggle in Craft Clips modal: Regular (GPT-5 Nano, 25 cr/batch, default) ⟷ Super (higher tier, more credits)
- Super tier = single constant `CRAFT_SUPER_PRESET` (client + server, currently `default`/40 cr) — change one place to upgrade
- Server whitelists `craftPower` and recomputes charged credits; premium-gated; unknown values fall back to Regular
- Persist choice in `pc_craft_clips_settings_v1`; blue/gold palette; aria/focus accessible

---

#### 55. Send to Phone QR — iPhone Notes-Friendly Flow
**Priority:** Low  
**Status:** Deferred (plain-text encoding improved Jun 2026; Safari redirect may still occur)  

**Requirements:**
- iPhone Camera may still open Safari for URL-like clip text when scanning "Send to phone" QR
- Future: improve plain-text QR / Apple copy-to-Notes UX (no browser redirect)
- Consider payload format, QR mode, or companion handoff that avoids URL detection heuristics

---

#### 56. Refactored Clip History in Activity Tab
**Priority:** Low  
**Status:** Future  

**Requirements:**
- Activity tab lists prior refactored siblings when user re-refactors (replaced clips)
- View-only restore or compare against current refactored sibling
- Local meta + refactor link history only (no new Supabase column)
- Defer until replace-on-re-refactor flow is stable in production

---

#### 57. Grammar API for AI Formatted (Craft Clips)
**Priority:** Medium  
**Status:** Future — explore alongside Craft Clips **#47** (`ai-format` edge function)

**Requirements:**
- Evaluate **LanguageTool** (REST API, tiered daily calls, self-host option), **Sapling** (usage-based ~$0.025/1K chars; Grammarly SDK alternative), **ProWritingAid** (official API sunsetting — verify enterprise/custom only)
- Integrate chosen grammar/writing API into `ai-format`; keep current LLM path as fallback when API unavailable, rate-limited, or key unset
- Preserve anti-AI-artifact guards; grammar API handles mechanics, LLM only for remaining polish gaps
- Server-side API keys only; premium-gated; compare cost, latency, and quality vs pure-LLM before defaulting provider

---

#### 58. PasteCraft Merchant (Seller Service Layer)
**Priority:** High  
**Status:** In progress (Phases 1–4 on main; Phase 5 built → user test; Phase 6–7 next)
**Depends on:** **#29** Spot, **#21** Image→Text top strip
**Roadmap doc:** `docs/merchant/MERCHANT-ROADMAP-AND-TEST-LAB.md` — feature assessment, nav/prefs, phases 1–9+, Merchant Test Lab (`merchant-test-lab/` at repo root, not pastecraft.com)
- Tags-first / tags-only default UI; title/description Advanced only — keep forever as default
- **Big three (core Merchant):** tags + materials + snippets — NOT alt text as core
- Core (must): tags, tag queue, Etsy 13×20 validation, platform presets (Etsy/Printify/generic)
- Next ROI: dock materials copy (Phase 5); snippet presets (personalization/compliance); Seal & Ship purge
- Alt text deprioritized — Phase 9+ “SEO pack” add-on only; not core marketing lever
- Phased vertical slices in `extension/content/merchant/`; user test between phases
- Separate Test Lab mock Etsy/Printify forms for QA + DOM adapters without marketplace accounts

**Product & subscription:**
- Separate subscription from PasteCraft Scholar (see **Product Lines & Roadmap**)
- Options: Scholar only, Merchant only, bundle (Scholar + Merchant)
- Extension stays "PasteCraft"; Scholar / Merchant are gated service layers

**Pricing (Merchant only):**
- **$1.99 weekly**, **$6.99 monthly**, **$15.99 yearly**
- Own Stripe prices + tier gate; ship after Spot + top-toolbar slice
- Client-side Spot/top-strip + ephemeral staging only — no per-call AI/API cost like Scholar AI Lab
- Lower price reflects no ongoing API burn; bundle with Scholar still TBD

**Ephemeral listing payload:**
- **Listing Dock** — temporary staging for title / description / tags (clip, AI, Spot list, clipboard)
- Corruptible Merchant-only layer with TTL; never permanent Scholar archive
- Merchant-only storage keys / staging table with `expires_at`; auto-expire fallback (e.g. 24h)

**UI flow:**
- **Merchant Pulse** — strip indicator (staging live / will vanish; "not saved forever")
- Spot paste/fill + tag queue until listing fields complete
- **Seal & Ship** — Done → success → confirm purge → corrupt/delete locally (+ cloud staging row)

**Spot Phase A+B (build with Merchant):**
- Listing pack clip shape: `title:` / `description:` / `tags:` sections
- Etsy tag profile: 13 tags × 20 chars, dedupe, preview before copy
- Batch copy/join (delimiter presets); tag queue "paste next tag"
- Import from clip / AI text; platform presets (Etsy, Printify, generic)

**Phase C (future) & gating:**
- Etsy DOM tag-input adapter — defer until A+B stable; see **Product Lines**
- `user_subscriptions`: `has_merchant` flag or tier enum (`scholar` | `merchant` | `bundle`)
- Spot + top strip → merchant; AI Lab → scholar; bundle = both flags active

---

#### 59. Blue Dark Mode UI Theme (Leonardo Catalog Look)
**Priority:** High  
**Status:** Phase 1 ✅; Phase 2 ✅; Phase 3 mostly done (3G chrome; 3H Clip Viewer/Album; 3I Custom Search + AI Breakdown pending verify); Batch 3 Craft Clips + Settings/Profile polish + Phase 4 content widget remaining  
**Refs:** `docs/design/blue-dark-mode-refs/` (Leonardo catalog PNGs + README)  
**Naming:**
- `light` = current PasteCraft (default, unchanged)
- `blue` = Blue Dark Mode (navy glass + electric blue) — this feature
- `dark` = true gray dark mode — still coming-soon / deferred

**Scope:** CSS tokens + surfaces only (no React)

**Palette scrap (target):**
- Midnight navy bg `#0a0e14` / `#0b1220`
- Glass panels `rgba(10,14,26,0.72–0.88)` + thin blue borders `#1e3a8a` / `#3b82f6`
- Accent electric blue `#2563eb`–`#3b82f6`; cyan glow accents
- Text white / soft sky; tags keep semantic pops (DIAGRAM/CSV/TSV)

**4 phases × 2 implementations each:**
1. **Phase 1** — (A) `tokens-blue.css` + `[data-theme="blue"]` overrides; (B) theme toggle wiring (`blue` vs `light`; Settings/Profile sync; label “Blue Dark Mode”)
2. **Phase 2** — (A) popup shell: header, tabs, clip cards, pagination, primary CTA; (B) primitives + clips/search CSS
3. **Phase 3** — (A) AI Lab / Notes / Categories / Settings / Profile panels; (B) Clip Joiner + crafted output + modals
4. **Phase 4** — (A) content widget + Quick Paste blue tokens; (B) Merchant strip/dock + optional glass transparency pass

**Rules:** token-first (no hardcode hex sprawl); glass optional/tunable; ask SUCCESS before SuccessLog; implement on `main`

---

#### 60. Widgets Tab (Embed Gallery — Notes ↔ AI History)
**Priority:** Medium  
**Status:** Completed (SUCCESS Jul 9, 2026)  
**Placement:** New popup tab between **Notes** and **AI History** (`data-tab="widgets"`)  
**Inspiration:** [Live Coin Watch Widgets](https://www.livecoinwatch.com/widgets) — copy-paste embed UX  

**Requirements:**
- Vertical slice: `extension/popup/features/widgets/` (controller, service, state, render, events, constants)
- User pastes embed HTML / iframe / script snippets from any widget site → sandboxed preview + save to personal gallery
- Multi-source (not LCW-only): crypto/markets + productivity/weather/clocks — curated “Get widgets” links
- UX: Add Widget → paste/validate → name + size → grid/list gallery; edit/remove/reorder; empty state with source tips
- Security: sandboxed iframes only; strip unsafe scripts; no eval of raw paste; store snippets in chrome.storage (+ sync later)

**Widget source catalog (research):**
- Markets: Live Coin Watch, CoinGecko, Vunelix, Arincen, NowPrice
- Productivity / ambient: Indify, Blocs, Elfsight (weather/clock/countdown/calendar)
- Accept any valid embed URL/iframe from other sites that fit the sandbox rules

**Out of scope (v1):** hosting PasteCraft-owned widget CDN; Merchant/Spot coupling; auto-scraping third-party sites; cloud sync of gallery

---

## Product Lines & Roadmap

See **#58** for full Merchant feature spec. **Architecture & Test Lab:** `docs/merchant/MERCHANT-ROADMAP-AND-TEST-LAB.md`.

### Brand split
- **PasteCraft Scholar** — core study/productivity (clips, categories, notes, search, AI Lab)
- **PasteCraft Merchant** — Etsy/POD seller add-on: **Spot #29** + **Image→Text #21** top strip
- Extension name stays "PasteCraft"; Scholar / Merchant are subscription **service layers**

### Subscription options (planned)
- **Scholar only** — existing FREE / BASIC / PREMIUM tiers (cloud sync + AI Lab)
- **Merchant only** — **$1.99/wk**, **$6.99/mo**, **$15.99/yr** (Spot + listing workflow; see **#58**)
- **Bundle (Scholar + Merchant)** — combined access; pricing TBD (may discount vs both separately)

### Merchant standalone — can it work without Scholar?
- **Yes** — self-sufficient for Etsy/POD at full quality
- **Includes:** minimal clips/categories, Spot lists, listing packs, top strip (Spot + #21), tag queue
- **Shared infra:** same extension, auth, Supabase; Merchant gates Spot/top strip; Scholar gates AI Lab

### Implementation order
1. **Next:** Spot #29 + Image→Text #21 shared ~1cm top strip on web pages
2. **Then:** **#59 Blue Dark Mode** — 4×2 CSS theme phases (popup → modules → widget/merchant); light stays default
3. **Later:** Merchant billing + gating — after toolbar slice works
- **#37 Tips bar** — removed from roadmap (already done)

### Spot phases (summary)
- **Phase A+B (Merchant — build first):** listing pack, Etsy tags, batch copy, tag queue — see **#58**
- **Phase C (future — do NOT build yet):** Etsy (then Printify) DOM tag-input adapter — follow-up to **#29**; ship after A+B stable

### Tomorrow
- Start **Spot + Image→Text** top-toolbar implementation (Merchant layer foundation)

---

## 🎯 **PRIORITY ROADMAP**

### Immediate (Post-MVP Release):
1. Monitor production issues
2. Gather user feedback
3. Performance optimization

### Short-term (1-2 months):
1. Offline mode & sync queue (reliability)
2. Categories cloud sync (feature parity)
3. Conflict resolution UI (UX improvement)

### Medium-term (3-6 months):
1. Real-time cross-device sync (premium feature)
2. Analytics & usage tracking (product insights)
3. Bulk operations & batch sync (performance)

### Long-term (6+ months):
1. Export/Import functionality
2. Collaboration features
3. Cross-browser expansion

---

## 📝 **FEATURE REQUEST PROCESS**

To request a new feature:

1. **Check Existing Requests** - See if it's already listed above
2. **Create Issue** - Document the feature request with:
   - Use case / problem it solves
   - Proposed solution
   - Priority (High/Medium/Low)
   - Technical considerations
3. **User Voting** - Let users vote on most wanted features
4. **Development Sprint** - Highest priority features get scheduled

---

## 🔧 **TECHNICAL DEBT & REFACTORING**

### Code Cleanup Needed:
- [ ] Remove debug console.logs before production
- [ ] Optimize image upload/download for performance
- [ ] Add comprehensive error handling
- [ ] Implement retry logic for failed syncs
- [ ] Add unit tests for sync methods
- [ ] Performance profiling and optimization

### Documentation Needed:
- [ ] API documentation for Supabase methods
- [ ] User guide for cloud sync features
- [ ] Developer guide for contributing
- [ ] Troubleshooting guide for common issues

---

**Next Review:** After user feedback from MVP release.

---

## 📁 Related Files

- **Completed Features:** `program-study/Completed/Implementations.md` - All MVP v1.0 implementations
- **Fixed Bugs:** `program-study/Fixed/RefreshFixedLog.md` - Resolved issues
- **Deployment Guide:** `MVP_DEPLOYMENT_CHECKLIST.md` - Production deployment steps

---

## **Mission Briefing: Standard Operating Protocol**

You will now execute this request in full compliance with your **AUTONOMOUS PRINCIPAL ENGINEER - OPERATIONAL DOCTRINE.** Each phase is mandatory. Deviations are not permitted.

---

## **Phase 0: Reconnaissance & Mental Modeling (Read-Only)**

-   **Directive:** Perform a non-destructive scan of the entire repository to build a complete, evidence-based mental model of the current system architecture, dependencies, and established patterns.

-   **Output:** Produce a concise digest (≤ 200 lines) of your findings. This digest will anchor all subsequent actions.

-   **Constraint:** **No mutations are permitted during this phase.**

---

## **Phase 1: Planning & Strategy**

-   **Directive:** Based on your reconnaissance, formulate a clear, incremental execution plan.

-   **Plan Requirements:**

    1.  **Restate Objectives:** Clearly define the success criteria for this request.

    2.  **Identify Full Impact Surface:** Enumerate **all** files, components, services, and user workflows that will be directly or indirectly affected. This is a test of your system-wide thinking.

    3.  **Justify Strategy:** Propose a technical approach. Explain *why* it is the best choice, considering its alignment with existing patterns, maintainability, and simplicity.

-   **Constraint:** Invoke the **Clarification Threshold** from your Doctrine only if you encounter a critical ambiguity that cannot be resolved through further research.

---

## **Phase 2: Execution & Implementation**

-   **Directive:** Execute your plan incrementally. Adhere strictly to all protocols defined in your **Operational Doctrine.**

-   **Core Protocols in Effect:**

    -   **Read-Write-Reread:** For every file you modify, you must read it immediately before and immediately after the change.

    -   **Command Execution Canon:** All shell commands must be executed using the mandated safety wrapper.

    -   **Workspace Purity:** All transient analysis and logs remain in-chat. No unsolicited files.

    -   **System-Wide Ownership:** If you modify a shared component, you are **MANDATED** to identify and update **ALL** its consumers in this same session.

---

## **Phase 3: Verification & Autonomous Correction**

-   **Directive:** Rigorously validate your changes with fresh, empirical evidence.

-   **Verification Steps:**

    1.  Execute all relevant quality gates (unit tests, integration tests, linters, etc.).

    2.  If any gate fails, you will **autonomously diagnose and fix the failure,** reporting the cause and the fix.

    3.  Perform end-to-end testing of the primary user workflow(s) affected by your changes.

---

## **Phase 4: Mandatory Zero-Trust Self-Audit**

-   **Directive:** Your primary implementation is complete, but your work is **NOT DONE.** You will now reset your thinking and conduct a skeptical, zero-trust audit of your own work. Your memory is untrustworthy; only fresh evidence is valid.

-   **Audit Protocol:**

    1.  **Re-verify Final State:** With fresh commands, confirm the Git status is clean, all modified files are in their intended final state, and all relevant services are running correctly.

    2.  **Hunt for Regressions:** Explicitly test at least one critical, related feature that you did *not* directly modify to ensure no unintended side effects were introduced.

    3.  **Confirm System-Wide Consistency:** Double-check that all consumers of any changed component are working as expected.

---

## **Phase 5: Final Report & Verdict**

-   **Directive:** Conclude your mission with a single, structured report.

-   **Report Structure:**

    -   **Changes Applied:** A list of all created or modified artifacts.

    -   **Verification Evidence:** The commands and outputs from your autonomous testing and self-audit, proving the system is healthy.

    -   **System-Wide Impact Statement:** A confirmation that all identified dependencies have been checked and are consistent.

    -   **Final Verdict:** Conclude with one of the two following statements, exactly as written:

        -   `"Self-Audit Complete. System state is verified and consistent. No regressions identified. Mission accomplished."`

        -   `"Self-Audit Complete. CRITICAL ISSUE FOUND. Halting work. [Describe issue and recommend immediate diagnostic steps]."`

-   **Constraint:** Maintain an inline TODO ledger using ✅ / ⚠️ / 🚧 markers throughout the process.
