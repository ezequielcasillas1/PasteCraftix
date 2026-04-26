-- Harden security_events table exposure.
-- Edge Functions use service-role credentials; anon access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_events FROM anon;
