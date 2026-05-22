-- AI Refactorization history type + user dissatisfaction tickets for admin review

ALTER TABLE public.ai_history DROP CONSTRAINT IF EXISTS ai_history_type_check;
ALTER TABLE public.ai_history ADD CONSTRAINT ai_history_type_check
  CHECK (type IN ('summary', 'breakdown', 'refactorization'));

CREATE TABLE IF NOT EXISTS public.refactor_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  history_id BIGINT,
  user_message TEXT NOT NULL DEFAULT '',
  before_text TEXT,
  after_text TEXT,
  refactor_level TEXT,
  synthesis JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_refactor_tickets_user_id ON public.refactor_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_refactor_tickets_status ON public.refactor_tickets(status);
CREATE INDEX IF NOT EXISTS idx_refactor_tickets_created_at ON public.refactor_tickets(created_at DESC);

ALTER TABLE public.refactor_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own refactor tickets" ON public.refactor_tickets;
CREATE POLICY "Users can insert own refactor tickets"
  ON public.refactor_tickets FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own refactor tickets" ON public.refactor_tickets;
CREATE POLICY "Users can view own refactor tickets"
  ON public.refactor_tickets FOR SELECT
  USING (auth.uid()::text = user_id);

REVOKE ALL ON TABLE public.refactor_tickets FROM anon;
GRANT SELECT, INSERT ON TABLE public.refactor_tickets TO authenticated;
