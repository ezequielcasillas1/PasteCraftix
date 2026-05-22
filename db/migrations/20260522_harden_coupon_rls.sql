-- Restrict coupon_codes SELECT to user's own redemptions only.
-- Date: 2026-05-22

DROP POLICY IF EXISTS "Anyone can view active coupon codes" ON public.coupon_codes;

CREATE POLICY "Users can view own redeemed coupon codes"
  ON public.coupon_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coupon_redemptions cr
      WHERE cr.coupon_code_id = coupon_codes.id
        AND cr.user_id = auth.uid()
    )
  );
