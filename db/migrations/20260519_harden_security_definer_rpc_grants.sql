-- Harden SECURITY DEFINER RPC exposure (Supabase Database Linter 0028/0029).
-- Triggers and cron jobs keep working; only PostgREST /rpc/ access is restricted.

BEGIN;

-- Legacy client RPC — not used; no RLS policy reads it.
DROP FUNCTION IF EXISTS public.set_config(text, text);

DO $$
DECLARE
  fn_name text;
  fn_sig regprocedure;
BEGIN
  FOREACH fn_name IN ARRAY ARRAY[
    'check_auto_ban_on_violation',
    'flag_coupon_abuse',
    'get_effective_access_state',
    'log_ddl_change',
    'log_row_change',
    'pc_check_insert_burst',
    'pc_check_quarantine_pause',
    'pc_confirm_delete_quarantined_user',
    'pc_detect_bursts',
    'pc_purge_quarantine',
    'pc_restore_quarantined_user',
    'pc_trigger_admin_alerts',
    'scan_clip_content_for_threats'
    -- user_is_not_banned: keep EXECUTE for authenticated (used by RLS policies; see fix migration)
  ]
  LOOP
    FOR fn_sig IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn_name
    LOOP
      EXECUTE format(
        'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        fn_sig
      );
    END LOOP;
  END LOOP;
END $$;

-- Extension: signed-in users may call server-side access evaluation (auth.uid check inside).
GRANT EXECUTE ON FUNCTION public.get_effective_access_state(text) TO authenticated;

-- Edge Functions / cron (service_role key).
GRANT EXECUTE ON FUNCTION public.pc_restore_quarantined_user(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pc_confirm_delete_quarantined_user(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pc_purge_quarantine() TO service_role;
GRANT EXECUTE ON FUNCTION public.pc_detect_bursts() TO service_role;
GRANT EXECUTE ON FUNCTION public.pc_trigger_admin_alerts() TO service_role;

-- Callable by authenticated extension clients; INVOKER avoids linter 0029 (uses auth.uid + RLS).
ALTER FUNCTION public.get_effective_access_state(text) SECURITY INVOKER;

COMMIT;
