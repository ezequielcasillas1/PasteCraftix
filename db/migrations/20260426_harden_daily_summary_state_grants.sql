-- Harden daily_summary_state table exposure.
-- Admin alert Edge Functions use server-side credentials; anon access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_summary_state FROM anon;
