-- Harden change_audit_log table exposure.
-- Activity history is authenticated and RLS-scoped by actor_auth_uid.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.change_audit_log FROM anon;
