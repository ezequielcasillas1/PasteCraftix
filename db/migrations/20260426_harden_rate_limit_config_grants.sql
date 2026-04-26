-- Harden rate_limit_config table exposure.
-- Rate-limit functions read this server-side; anon table access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_config FROM anon;
