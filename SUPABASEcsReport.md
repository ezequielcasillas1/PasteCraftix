# PasteCraft Security Vulnerability Report

**Date:** 2026-04-07  
**Scope:** Supabase RLS, Edge Functions, Rate Limiting, Storage  
**Source:** Supabase MCP Security Advisor + Code Analysis

---

## CRITICAL: RLS Policies Bypassed

**Severity: CRITICAL**  
**Status:** REQUIRES IMMEDIATE FIX

These tables have `USING (true)` / `WITH CHECK (true)` policies that allow **ANY authenticated user to access ANY user's data**:

| Table | Policy Name | Impact |
|-------|-------------|--------|
| `clips` | "Allow all for clips" | Any user can read/modify all clips |
| `categories` | "Allow all for categories" | Any user can read/modify all categories |
| `archived_clips` | "Allow all for archived_clips" | Any user can read/modify all archives |
| `settings` | "Allow all for settings" | Any user can read/modify all settings |
| `user_profiles` | "Allow all for user_profiles" | Any user can read/modify all profiles |

**Fix Required:** Drop these policies and ensure proper `auth.uid()::text = user_id` policies exist.

---

## Additional Issues from Supabase Linter

### change_audit_log - No RLS Policies (INFO)
- Table has RLS enabled but NO policies defined
- Contains 1,017,310 rows
- Could expose audit data

### Function Search Path Mutable (WARN)
Functions with mutable search_path (potential SQL injection vector):
- `update_updated_at_column`
- `set_config`
- `check_profile_update_limit`
- `auto_archive_old_clips`
- `search_clips`

### Leaked Password Protection Disabled (WARN)
- Supabase Auth not checking against HaveIBeenPwned.org
- Enable in Dashboard → Auth → Settings

---

## Previously Identified Vulnerabilities

### 1. No Rate Limiting on Clips/Notes/Categories Inserts (HIGH)

**Tables Affected:**
- `clips`
- `notes`
- `categories`
- `archived_clips`
- `clipboard_history`

**Risk:** Malicious user can spam thousands of inserts per minute, draining Realtime message quota and storage.

**Impact:** Same issue fixed for `user_profiles` applies to all these tables.

**Recommendation:** Add daily insert rate limiting triggers similar to `check_profile_update_limit()`.

---

### 2. Coupon Code Brute-Force Vulnerability (MEDIUM)

**Location:** `supabase/functions/redeem-coupon/index.ts`

**Risk:** 
- No rate limiting on coupon redemption attempts
- Codes are predictable patterns (PASTE3, PASTE6, PASTE12)
- Attacker could try thousands of codes per minute

**Recommendation:** 
- Add per-user rate limiting (e.g., 5 attempts per hour)
- Add failed attempt tracking
- Consider random code generation for future coupons

---

### 3. Storage Bucket Missing Size Limits (MEDIUM)

**Location:** `profile-images` bucket

**Risk:**
- Any authenticated user can upload files
- No file size limits enforced at RLS level
- Users could upload massive files to exhaust storage quota

**Recommendation:**
- Add file size validation in upload function
- Configure bucket max file size in Supabase dashboard
- Add storage usage tracking per user

---

### 4. Realtime Enabled on All Tables Without Server-Side Filtering (LOW-MEDIUM)

**Tables with Realtime:**
- `user_profiles` (rate limited)
- `clips` (NOT rate limited)
- `notes` (NOT rate limited)
- `categories` (NOT rate limited)
- `archived_clips` (NOT rate limited)
- `settings` (NOT rate limited)
- `clipboard_history` (NOT rate limited)
- `pastecraft_devices` (NOT rate limited)
- `ai_history` (NOT rate limited)

**Risk:** Mass updates to non-rate-limited tables can drain Realtime message quota.

**Recommendation:** Add rate limiting triggers to high-traffic tables.

---

### 5. Missing audit_log Accumulation Protection (LOW)

**Location:** `audit_log` table

**Risk:**
- Has INSERT policy but no limit on entries per user
- Could accumulate unlimited audit entries

**Recommendation:** 
- Add trigger to limit audit entries (e.g., keep last 1000 per user)
- Or implement periodic cleanup job

---

## Priority Action Items

| Priority | Vulnerability | Effort |
|----------|--------------|--------|
| HIGH | Add rate limiting to clips/notes inserts | Medium |
| MEDIUM | Add coupon brute-force protection | Low |
| MEDIUM | Configure storage bucket size limits | Low |
| LOW | Add audit_log cleanup trigger | Low |

---

## Status

- [ ] Clips rate limiting migration
- [ ] Notes rate limiting migration
- [ ] Coupon attempt rate limiting
- [ ] Storage bucket size limits
- [ ] Audit log cleanup
