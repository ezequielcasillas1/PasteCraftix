-- Idempotent credit-pack fulfillment: record when purchased balance was applied.

ALTER TABLE public.credit_purchases
  ADD COLUMN IF NOT EXISTS balance_applied_at TIMESTAMPTZ;

COMMENT ON COLUMN public.credit_purchases.balance_applied_at IS
  'Set when ai_purchased_credits_balance was incremented for this session; null allows webhook retry.';

-- Assume prior rows were fully fulfilled before this column existed.
UPDATE public.credit_purchases
SET balance_applied_at = purchased_at
WHERE balance_applied_at IS NULL;
