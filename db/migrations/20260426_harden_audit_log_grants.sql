-- Harden audit_log table exposure.
-- Authenticated users keep RLS-scoped access; anon access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log FROM anon;
