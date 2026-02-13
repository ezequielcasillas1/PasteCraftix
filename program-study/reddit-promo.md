# PasteCraft Reddit Launch Promo

## Coupon Code: `REDDIT100`

| Detail | Value |
|---|---|
| **Code** | `REDDIT100` |
| **Benefit** | 1 year free AI access (all premium AI features) |
| **Type** | `months_free` (12 months) |
| **Max Redemptions** | 100 users |
| **Expires** | June 12, 2026 |
| **Status** | Active |

## How Users Redeem
1. Install PasteCraft extension from Chrome Web Store
2. Sign up (Google or email)
3. Open PasteCraft → Settings → enter coupon code `REDDIT100`
4. Done — 1 year free AI access activated

## Tracking
- **Check redemptions:** Supabase Dashboard → Table Editor → `coupon_redemptions`
- **Check remaining slots:** `coupon_codes` table → `redemption_count` vs `max_redemptions`

```sql
-- Quick check remaining slots
SELECT code, max_redemptions - redemption_count AS remaining
FROM coupon_codes WHERE code = 'REDDIT100';
```

## Deactivate Early (if needed)
```sql
UPDATE coupon_codes SET is_active = FALSE WHERE code = 'REDDIT100';
```
