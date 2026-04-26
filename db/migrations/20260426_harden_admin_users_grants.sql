-- Harden admin_users table exposure.
-- Service-role admin APIs still bypass RLS; authenticated policy checks keep SELECT.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users FROM anon;
