# PasteCraft Security & Storage RLS Audit

**Date:** 2026-05-26  
**Scope:** Automatic banning, table RLS, Supabase Storage (`profile-images`), extension message/auth hardening  
**Method:** Repo migration + Edge Function + extension code review. Live Supabase MCP was unavailable (needs auth) — production state must be verified separately.

---

## 1. What automatically bans someone?

### Direct answer

**Nothing in this repository automatically sets `user_profiles.is_banned = true`.**

Bans are **manual only** via localhost `admin-api` → `doBanUser()` (`supabase/functions/admin-api/index.ts`).

Every automated path either **blocks an action**, **pauses** the account, or **logs an event** — it does not flip `is_banned`.

---

### Automated responses (not bans)

| Trigger | What happens | Sets `is_banned`? | Where |
|---------|--------------|-------------------|--------|
| Burst flood (10× per-minute cap in 10 min) | Rows quarantined; `quarantine_paused_until` +1h; email alert | **No** | `pc_detect_bursts()` — `db/migrations/20260417_phase3_quarantine_shield.sql` |
| Insert while quarantine-paused | INSERT rejected with exception | **No** | `pc_check_quarantine_pause()` trigger |
| Daily clip cap (700 default) | INSERT rejected; violation logged | **No** | `check_clip_insert_limit()` — `20260408_clip_rate_limit.sql` |
| Burst per-minute / per-hour caps | INSERT rejected; violation logged | **No** | `pc_check_insert_burst()` — `20260417_phase2_burst_rate_limits.sql` |
| Already banned user inserts clip | INSERT rejected | **No** (reads existing ban) | `check_clip_insert_limit()` |
| >10 checkout attempts / hour | `security_events` row; HTTP 429 | **No** (`auto_banned: false`) | `create-checkout/index.ts` L56–88 |
| >5 coupon attempts / hour | HTTP 429 | **No** | `redeem-coupon/index.ts` L45–61 |
| Edge Function call while banned | HTTP 403 | **No** (reads existing ban) | `requireNotBanned()` — `security-gate.ts` |
| Ban with expiry passed | **Auto-unban** (`is_banned = false`) | Lifts ban | `security-gate.ts` L34–41 |

---

### Quarantine vs ban

| | **Quarantine pause** | **Ban (`is_banned`)** |
|--|----------------------|------------------------|
| **Automatic?** | Yes (burst detector cron) | No |
| **Duration** | ~1 hour pause + row quarantine | Until admin unban or `ban_expires_at` |
| **Effect** | Blocks INSERTs; hides quarantined rows from SELECT | Blocks clips trigger + Edge Functions via `requireNotBanned` |
| **Recovery** | Admin restore RPC or wait for pause to expire | Admin unban only |

---

### Functions referenced but not defined in repo

Migration `20260519_harden_security_definer_rpc_grants.sql` revokes public access to:

- `check_auto_ban_on_violation`
- `flag_coupon_abuse`
- `scan_clip_content_for_threats`

**No `CREATE FUNCTION` for these exists in the repository.** They may exist only in production (manual SQL) or be stale names. **Verify in Supabase SQL editor:**

```sql
SELECT proname, prosrc IS NOT NULL AS has_body
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'check_auto_ban_on_violation',
    'flag_coupon_abuse',
    'scan_clip_content_for_threats'
  );
```

If they exist in prod but not in repo, that is a **drift risk**.

---

## 2. Table RLS audit (repo state)

### Overall posture

Migrations from April–May 2026 show a deliberate hardening pass:

- Per-user `auth.uid()::text = user_id` policies in `db/supabase-schema.sql`
- Anon `REVOKE` on sensitive tables (`20260426_harden_*_grants.sql`)
- Quarantine-aware SELECT on clips/notes/categories/ai_history (`phase3_quarantine_shield.sql`)
- Subscription tier tampering blocked (`20260522_harden_user_subscriptions_rls.sql`)
- Coupon enumeration closed (`20260522_harden_coupon_rls.sql`)
- `security_events`, `quarantine_events`, admin tables — admin/service only

`db/vulnerabilityfixes.md` checklist marks critical “Allow all” policies as **applied 2026-04-08**. Re-verify in production (see Section 4).

---

### Table-by-table summary

| Table | RLS | Policy pattern | Notes |
|-------|-----|----------------|-------|
| `clips` | On | Own rows; SELECT hides `quarantined_at IS NOT NULL` | Burst + daily + quarantine triggers |
| `notes` | On | Same quarantine SELECT | Burst + quarantine triggers |
| `categories` | On | Same | Burst + quarantine triggers |
| `ai_history` | On | Same | Burst + quarantine; anon revoked |
| `archived_clips` | On | Own rows only | No quarantine columns; anon revoked |
| `settings` | On | Own rows | **No** burst/quarantine triggers |
| `clipboard_history` | On | Own rows | **No** burst limits in migrations |
| `user_profiles` | On | Own rows SELECT/INSERT/UPDATE | **See finding F-1** |
| `user_subscriptions` | On | SELECT own; INSERT signup-only; UPDATE blocked for clients | Hardened 20260522 |
| `coupon_codes` | On | SELECT only if user redeemed | Hardened 20260522 |
| `coupon_attempt_log` | On | INSERT own user_id only | Hardened 20260417 |
| `security_events` | On | No client access (anon revoked) | Edge Functions use service role |
| `quarantine_events` | On | Admin only | |
| `rate_limit_violations` | On | Admin JWT policy | |
| `page_views` | On | anon/authenticated INSERT only (`WITH CHECK true`) | Path length constraints 20260522 |
| `admin_*` tables | On | Admin only | |
| `change_audit_log` | On | Own user SELECT/INSERT | Fixed 20260408 |

---

### Finding F-1 — `user_profiles` UPDATE too permissive (MEDIUM)

Policy allows any column update on own row:

```508:510:db/supabase-schema.sql
CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid()::text = user_id);
```

A signed-in user could potentially self-modify:

- `is_banned` → clear their own ban client-side (Edge Functions still check ban on next call, but DB clip trigger also reads `is_banned`)
- `quarantine_paused_until` → clear auto-pause without admin restore
- `daily_clip_limit` → raise their own cap

Only guard today: `check_profile_update_limit()` (50 updates/day), not column allowlist.

---

### Finding F-2 — `ban_gate_*` RLS policies missing from repo (MEDIUM)

Migrations reference restrictive policies calling `user_is_not_banned()`:

- `20260521_fix_sync_rls_grants.sql` comment: *"ban_gate_* restrictive policies call user_is_not_banned()"*

Function exists:

```7:18:db/migrations/20260521_fix_sync_rls_grants.sql
CREATE OR REPLACE FUNCTION public.user_is_not_banned()
 ...
  SELECT NOT COALESCE(
    (SELECT is_banned FROM public.user_profiles WHERE user_id = auth.uid()::text LIMIT 1),
    false
  );
```

**No `CREATE POLICY ... AS RESTRICTIVE` for `ban_gate_*` appears in any migration file.** Ban enforcement for DB writes currently relies on:

- Clip insert trigger checking `is_banned` (clips only)
- Edge Function `requireNotBanned` (AI, checkout, coupon)

**Gap:** Banned user may still INSERT/UPDATE notes, categories, settings via PostgREST if RLS does not invoke `user_is_not_banned()`.

---

### Finding F-3 — `settings` / `clipboard_history` lack anti-spam shields (LOW)

Burst limits and quarantine apply to clips, notes, categories, ai_history — not `settings` or `clipboard_history`. Lower abuse risk but inconsistent coverage.

---

### Finding F-4 — `page_views` open INSERT (LOW, by design)

Anon can INSERT any row matching path constraints. Acceptable for analytics; could be spammed. Mitigated by path length checks (`20260522_harden_page_views.sql`).

---

## 3. Storage RLS audit — `profile-images` bucket

### Intended design

| Control | Detail |
|---------|--------|
| **Bucket** | `profile-images` (public bucket — URLs work without SELECT policy) |
| **Upload path** | `{auth.uid()}/{timestamp}.{ext}` — enforced in client |
| **INSERT/UPDATE/DELETE** | Scoped to `(storage.foldername(name))[1] = auth.uid()::text` |
| **SELECT policy** | Was public read; **dropped** in tighten migration |

**Client compliance:**

```58:65:extension/supabase/profile-images.js
    // Path must live under a `{userId}/` folder so the Storage RLS policy
    // `(storage.foldername(name))[1] = auth.uid()::text` passes.
    const filePath = `${userId}/${timestamp}.${ext}`;

    const { error } = await this.client.storage
      .from('profile-images')
      .upload(filePath, blob, { contentType: ct || 'image/png', upsert: false });
```

Upload uses authenticated Supabase client with user JWT — correct pattern.

---

### Policy timeline in repo

| Stage | File | State |
|-------|------|-------|
| **Initial secure policies** | `db/supabase-fixes.sql` L40–66 | Per-user folder on INSERT/UPDATE/DELETE; public SELECT |
| **Permissive alternative (commented)** | `db/supabase-fixes.sql` L74–88 | `Allow all uploads/updates/deletes` — **must never be applied** |
| **Tighten migration** | `20260417_tighten_rls_and_functions.sql` | **Drops** 5 legacy policies including permissive ones and public SELECT |

**Important:** Tighten migration **only drops** policies. It assumes per-user authenticated policies from `supabase-fixes.sql` already exist and remain. It does **not** recreate them.

---

### Storage findings

| ID | Severity | Finding |
|----|----------|---------|
| **S-1** | HIGH if prod drift | If `20260417_tighten_rls_and_functions.sql` ran **without** prior per-user policies, authenticated users may have **no INSERT policy** (uploads fail) OR old permissive policies may still exist if tighten never ran |
| **S-2** | INFO | Public bucket + `getPublicUrl()` means **anyone with the URL can view** images — expected for profile avatars; not secret storage |
| **S-3** | LOW | No repo migration sets bucket file size / MIME restrictions at Storage API level — relies on dashboard config (supabase-fixes.md says 5 MB, image types) |
| **S-4** | LOW | Only one bucket in codebase; no clip attachment bucket RLS in migrations |

---

### Production verification SQL (run in Supabase SQL editor)

```sql
-- Storage policies on profile-images
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname ILIKE '%profile%'
ORDER BY policyname;

-- Bucket public flag
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'profile-images';

-- Dangerous permissive names should return 0 rows
SELECT policyname FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN (
    'Allow all uploads to profile-images',
    'Allow all updates to profile-images',
    'Allow all deletes from profile-images'
  );
```

**Expected healthy state:**

- INSERT/UPDATE/DELETE policies scoped to `auth.uid()` folder
- **No** `Allow all *` policies
- Bucket `public = true` (optional SELECT policy not required for public URLs)

---

## 4. Extension & Edge Function security (brief)

Audited as part of overall posture — no changes requested.

| Area | Status |
|------|--------|
| MV3 CSP on extension pages | Present — `extension/manifest.json` |
| Internal message sender check | Present — `messages-internal.js` L12–15 |
| External origin lock | Present — `auth.pastecraft.com` only |
| HTML sanitization | DOMPurify in `markup-renderer.js` |
| Site guard | Present — `content/safety/site-guard.js` |
| Stripe webhook signature | Verified in `stripe-webhook/index.ts` |
| Ban gate on sensitive Edge routes | AI, checkout, coupon |

---

## 5. Production verification checklist

Run these because MCP could not query live Supabase:

```sql
-- 1. No "Allow all" table policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND policyname ILIKE '%allow all%';

-- 2. Clips SELECT includes quarantine filter
SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'clips' AND cmd = 'SELECT';

-- 3. ban_gate policies exist (if intended)
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND policyname ILIKE 'ban_gate%';

-- 4. Orphan auto-ban functions
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('check_auto_ban_on_violation','flag_coupon_abuse','scan_clip_content_for_threats');
```

---

## 6. Audit summary

| Category | Verdict |
|----------|---------|
| **Automatic ban** | **None in repo.** Quarantine pause + rate blocks + event logging only. Manual ban via localhost admin-api. |
| **Table RLS** | **Generally strong** in migrations; **F-1** (profile self-escalation) and **F-2** (missing ban_gate policies in repo) need attention. |
| **Storage RLS** | **Correct design** if per-user policies exist and permissive policies were dropped; **verify prod** (**S-1**). |
| **Live prod state** | **Not verified** this session — run Section 4–5 SQL in dashboard. |

---

*Audit performed from repository source only. No code or migrations were changed.*
