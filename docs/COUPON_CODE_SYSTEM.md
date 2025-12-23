# 🎟️ Coupon Code System

## Overview

Flexible coupon code system that supports multiple codes with different benefits:
- **Unlimited access** (for developers/special cases)
- **Time-limited access** (3 months, 6 months, 1 year, etc.)

## Database Schema

### `coupon_codes` Table
Stores all valid coupon codes and their benefits:

```sql
- code: TEXT (unique) - The coupon code (case-insensitive)
- benefit_type: TEXT - 'unlimited' or 'months_free'
- benefit_value: INTEGER - NULL for unlimited, or number of months
- is_active: BOOLEAN - Whether the coupon is currently active
- description: TEXT - Optional description
- expires_at: TIMESTAMPTZ - Optional expiration date for the coupon itself
```

### `user_subscriptions` Table Updates
Tracks AI access from coupon codes:

```sql
- has_unlimited_ai: BOOLEAN - True if unlimited access (never expires)
- ai_access_expires_at: TIMESTAMPTZ - When temporary access expires (NULL if unlimited)
```

## Setup

1. **Run the migration:**
   ```sql
   -- Run coupon-code-migration.sql in Supabase SQL Editor
   ```

2. **Deploy the edge function:**
   ```bash
   supabase functions deploy redeem-coupon
   ```

3. **Add coupon codes:**
   ```sql
   -- See example-coupon-codes.sql for examples
   ```

## Adding New Coupon Codes

### Unlimited Access (Developer)
```sql
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description)
VALUES ('DEV826', 'unlimited', NULL, TRUE, 'Developer coupon - Unlimited AI access');
```

### 3 Months Free
```sql
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description)
VALUES ('FREEMONTH3', 'months_free', 3, TRUE, '3 months free AI access');
```

### 6 Months Free
```sql
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description)
VALUES ('FREEMONTH6', 'months_free', 6, TRUE, '6 months free AI access');
```

### 1 Year Free
```sql
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description)
VALUES ('FREEMONTH12', 'months_free', 12, TRUE, '1 year free AI access');
```

### Limited-Time Coupon (Expires on Specific Date)
```sql
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, expires_at)
VALUES ('HOLIDAY2025', 'months_free', 3, TRUE, 'Holiday special', '2025-12-31 23:59:59+00');
```

## Deactivating Coupon Codes

```sql
UPDATE coupon_codes 
SET is_active = FALSE 
WHERE code = 'OLDCODE';
```

## How It Works

1. User enters coupon code in Settings
2. Edge function validates code against `coupon_codes` table
3. Checks if coupon is active and not expired
4. Applies benefit:
   - **Unlimited**: Sets `has_unlimited_ai = true`
   - **Months Free**: Sets `ai_access_expires_at` to future date
5. User gains AI access based on benefit type

## Access Check Logic

The `isPremiumUser()` function checks:
1. `has_unlimited_ai === true` → ✅ Access granted
2. `ai_access_expires_at > now` → ✅ Access granted (temporary)
3. Premium/Admin tier → ✅ Access granted
4. Otherwise → ❌ No access

## Files

- `coupon-code-migration.sql` - Database migration
- `example-coupon-codes.sql` - Example coupon codes
- `supabase/functions/redeem-coupon/index.ts` - Edge function
- `supabase-client.js` - Client-side redemption logic
- `popup.js` - UI handling










