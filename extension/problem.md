# Cross Sync — Intended Functionality (Summary)

## Goal
- Let a user **move missing items from Device A to Device B** (and vice versa) in a controlled, manual way.
- Only show **items that exist on the remote device** but **do not exist locally**.

## User Flow
- User opens PasteCraft on Device B and clicks **“View Available Devices to Sync”**.
- PasteCraft shows a list of the user’s **other devices** connected to the same account.
- User selects Device A and sees a list of **importable items** (clips, notes, categories).
- User clicks **Import** on any item and it is added to Device B’s local data and becomes visible immediately.

## What Counts as “Already Local”
- An item should not appear as importable if Device B already has it (same content / same origin).
- The device sync panel should be safe against duplicates (importing twice should not create duplicates).

## Requirements / Expectations
- Devices should be discoverable when signed in and cloud sync is available.
- The list should update when switching devices and after imports.
- If there’s nothing new to import, the UI should clearly say so (not silently fail).

---

# Future: Forgot Email via Phone Number

## Goal
- Let a user recover their account email by entering a verified phone number.

## Requirements
- Add `phone`, `phone_country_code`, `phone_verified` columns to `user_profiles`.
- Collect + SMS-verify phone at signup (and allow adding later in `/account` settings).
- Edge Function `recover-email` (service role) takes phone → returns **masked** email (e.g. `e***@g***.com`) or sends reminder via SMS.
- Rate-limit the lookup endpoint to prevent phone enumeration.
- Never return a full email directly — always masked or SMS-delivered.