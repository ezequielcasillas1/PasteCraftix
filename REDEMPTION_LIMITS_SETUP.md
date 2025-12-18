# 🎟️ Coupon Code Redemption Limits Setup

## Quick Copy/Paste Guide

### 1. SQL Migration (Run in Supabase SQL Editor)

Copy and paste the entire contents of `coupon-code-migration.sql` into Supabase SQL Editor and run it.

**Key Features:**
- ✅ `DEV4EVER` - 1 redemption (unlimited AI access)
- ✅ `PASTE3` - 2 redemptions (3 months free)
- ✅ `PASTE6` - 2 redemptions (6 months free)
- ✅ `PASTE12` - 2 redemptions (12 months free)

### 2. Edge Function (Deploy to Supabase)

Copy and paste the entire contents of `supabase/functions/redeem-coupon/index.ts` and deploy:

```bash
supabase functions deploy redeem-coupon
```

## How It Works

1. **Prevents duplicate redemptions**: Each user can only redeem each code once
2. **Tracks redemption limits**: Codes have `max_redemptions` limit
3. **Counts redemptions**: `redemption_count` tracks how many times code was used
4. **Records history**: `coupon_redemptions` table stores who redeemed what

## Redemption Limits

| Code | Benefit | Max Redemptions |
|------|---------|----------------|
| `DEV4EVER` | Unlimited AI access | 1 time |
| `PASTE3` | 3 months free | 2 times |
| `PASTE6` | 6 months free | 2 times |
| `PASTE12` | 12 months free | 2 times |

## Error Messages

- "You have already redeemed this coupon code" - User tried to redeem same code twice
- "This coupon code has reached its redemption limit" - Code has been used max_redemptions times

## Verification Queries

```sql
-- Check redemption counts
SELECT code, benefit_type, benefit_value, max_redemptions, redemption_count 
FROM coupon_codes 
ORDER BY code;

-- Check all redemptions
SELECT cr.*, cc.code, u.email 
FROM coupon_redemptions cr
JOIN coupon_codes cc ON cr.coupon_code_id = cc.id
JOIN auth.users u ON cr.user_id = u.id
ORDER BY cr.redeemed_at DESC;
```







