#!/usr/bin/env node
/**
 * Apply security RLS migration and run verification queries.
 *
 * Requires DATABASE_URL (Supabase → Settings → Database → Connection string → URI)
 *   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Usage:
 *   DATABASE_URL='...' node scripts/security/apply-and-verify.mjs
 *   DATABASE_URL='...' node scripts/security/apply-and-verify.mjs --verify-only
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const MIGRATION = join(ROOT, 'db/migrations/20260526180000_security_rls_hardening.sql');
const VERIFY = join(ROOT, 'scripts/security/verify-security-rls.sql');

const verifyOnly = process.argv.includes('--verify-only');
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

if (!dbUrl) {
  console.error('Missing DATABASE_URL (or SUPABASE_DB_URL).');
  console.error('Get it from Supabase Dashboard → Project Settings → Database → Connection string.');
  process.exit(1);
}

const { default: pg } = await import('pg');
const { Client } = pg;

async function runSql(client, sql, label) {
  console.log(`\n--- ${label} ---\n`);
  const res = await client.query(sql);
  if (Array.isArray(res)) {
    res.forEach((r, i) => {
      if (r.rows?.length) {
        console.log(`Result set ${i + 1} (${r.rows.length} rows):`);
        console.table(r.rows.slice(0, 20));
        if (r.rows.length > 20) console.log(`... and ${r.rows.length - 20} more`);
      } else {
        console.log(`OK (${r.command || 'done'})`);
      }
    });
    return res;
  }
  if (res.rows?.length) {
    console.table(res.rows.slice(0, 30));
  } else {
    console.log(`OK (${res.command})`);
  }
  return res;
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('Connected to database.');

  if (!verifyOnly) {
    const migrationSql = readFileSync(MIGRATION, 'utf8');
    await runSql(client, migrationSql, 'Applying migration 20260526180000_security_rls_hardening.sql');
    console.log('Migration applied.');
  }

  const checks = [
    [`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND policyname ILIKE '%allow all%'`, 'Allow-all policies (expect 0 rows)'],
    [`SELECT COUNT(*)::int AS ban_gate_count FROM pg_policies WHERE schemaname = 'public' AND policyname ILIKE 'ban_gate%'`, 'ban_gate policy count'],
    [`SELECT tgname FROM pg_trigger WHERE tgname = 'aaa_guard_user_profiles'`, 'Profile guard trigger'],
    [`SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%profile%' ORDER BY policyname`, 'Storage profile-images policies'],
    [`SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%allow all%'`, 'Storage allow-all (expect 0)'],
    [`SELECT name, public FROM storage.buckets WHERE name = 'profile-images'`, 'profile-images bucket'],
    [`SELECT table_name, per_minute, per_hour FROM public.rate_limit_config WHERE table_name IN ('settings','clipboard_history')`, 'Burst config'],
  ];

  let failed = false;
  for (const [sql, label] of checks) {
    const res = await client.query(sql);
    console.log(`\n--- ${label} ---\n`);
    if (res.rows?.length) console.table(res.rows);
    else console.log('(no rows)');
    if (label.includes('Allow-all') && res.rows.length > 0) failed = true;
    if (label.includes('ban_gate_count') && res.rows[0]?.ban_gate_count < 14) failed = true;
    if (label.includes('guard trigger') && res.rows.length === 0) failed = true;
    if (label.includes('Storage allow-all') && res.rows.length > 0) failed = true;
  }

  if (failed) {
    console.error('\nVerification FAILED — review output above.');
    process.exit(1);
  }
  console.log('\nVerification PASSED.');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
