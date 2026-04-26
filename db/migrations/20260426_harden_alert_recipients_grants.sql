-- Harden alert_recipients table exposure.
-- Admin alert Edge Functions use server-side credentials; anon access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.alert_recipients FROM anon;
