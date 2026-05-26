# Apply security RLS hardening

Fixes audit findings F-1, F-2, S-1, F-3.

## 1. Get connection string

Supabase Dashboard → **Project Settings** → **Database** → **Connection string** → **URI** (Session pooler or Direct).

```bash
export DATABASE_URL='postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres'
```

## 2. Apply + verify

```bash
npm install
npm run security:apply
```

Verify only (after migration already applied):

```bash
npm run security:verify
```

## 3. Manual SQL (alternative)

Run in Supabase SQL Editor:

1. `db/migrations/20260526180000_security_rls_hardening.sql`
2. `scripts/security/verify-security-rls.sql`

## What it fixes

| Finding | Fix |
|---------|-----|
| F-1 | `guard_user_profiles_client_writes` trigger blocks privileged column tampering |
| F-2 | `ban_gate_*` restrictive RLS on all sync tables |
| S-1 | Per-user folder storage policies on `profile-images` |
| F-3 | Burst rate limits on `settings` + `clipboard_history` |
