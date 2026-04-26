-- Harden quarantine_events table exposure.
-- Admin Edge Functions and database triggers use privileged paths; anon access is not needed.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.quarantine_events FROM anon;
