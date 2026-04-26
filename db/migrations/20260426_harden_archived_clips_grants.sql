-- Harden archived_clips table exposure.
-- Archived clip sync runs through authenticated Supabase sessions.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.archived_clips FROM anon;
