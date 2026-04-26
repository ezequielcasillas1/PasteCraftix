-- Harden ai_history table exposure.
-- AI History cloud sync runs through authenticated Supabase sessions.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_history FROM anon;
