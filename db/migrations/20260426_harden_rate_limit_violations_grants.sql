-- Harden rate_limit_violations table exposure.
-- Admin APIs and rate-limit functions use privileged/admin paths; anon access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_violations FROM anon;
