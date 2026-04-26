-- Harden alert_state table exposure.
-- Admin alert Edge Functions use server-side credentials; anon access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.alert_state FROM anon;
