-- Admin action audit log for localhost admin-api operations.
-- Date: 2026-05-22

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON public.admin_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions (admin_user_id);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_actions admin only" ON public.admin_actions;
CREATE POLICY "admin_actions admin only"
  ON public.admin_actions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text));

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_actions FROM anon;

-- AI name rate limit log
CREATE TABLE IF NOT EXISTS public.ai_name_attempt_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_name_attempt_user_time
  ON public.ai_name_attempt_log (user_id, attempted_at DESC);

ALTER TABLE public.ai_name_attempt_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_name_attempt_log FROM anon, authenticated;
