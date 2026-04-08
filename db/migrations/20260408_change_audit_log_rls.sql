-- Migration: Add RLS policies to change_audit_log (Option A - User sees only their own logs)
-- Date: 2026-04-08
-- Enables Activity Log History UI feature
-- Note: Uses actor_auth_uid column (uuid type)

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own change audit" ON public.change_audit_log;
DROP POLICY IF EXISTS "Users can insert their own change audit" ON public.change_audit_log;

-- Users can only SELECT their own audit logs
CREATE POLICY "Users can view their own change audit"
ON public.change_audit_log FOR SELECT
USING (auth.uid() = actor_auth_uid);

-- Users can only INSERT audit logs for themselves
CREATE POLICY "Users can insert their own change audit"
ON public.change_audit_log FOR INSERT
WITH CHECK (auth.uid() = actor_auth_uid);
