-- Reinforce sync RLS after security-definer hardening (20260519).
-- ban_gate_* restrictive policies call user_is_not_banned(); authenticated needs EXECUTE.
-- archived_clips / ai_history: authenticated table grants + RLS (no anon bypass).

BEGIN;

CREATE OR REPLACE FUNCTION public.user_is_not_banned()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path = public
AS $function$
  SELECT NOT COALESCE(
    (SELECT is_banned FROM public.user_profiles WHERE user_id = auth.uid()::text LIMIT 1),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.user_is_not_banned() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_not_banned() FROM anon;
GRANT EXECUTE ON FUNCTION public.user_is_not_banned() TO authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.archived_clips FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_history FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.archived_clips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_history TO authenticated;

COMMIT;
