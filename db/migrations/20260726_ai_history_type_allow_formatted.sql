-- Allow AI Formatted craft history to sync to ai_history
ALTER TABLE public.ai_history DROP CONSTRAINT IF EXISTS ai_history_type_check;
ALTER TABLE public.ai_history ADD CONSTRAINT ai_history_type_check
  CHECK (type IN ('summary', 'breakdown', 'refactorization', 'formatted'));
