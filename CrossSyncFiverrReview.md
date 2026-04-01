# PasteCraft Cross-Sync (Fiverr Review Handoff)

## Current Symptom
- “View Available Devices to Sync” opens, but **no devices** or **no importable items** appear.
- Reported behavior: even when Device A has clips not on Device B, Device B shows nothing.

## Expected Behavior (Correctness)
- Device B lists remote devices (Device A, etc.).
- Selecting a remote device shows **items present on that device** that are **not present locally**.
- Import pulls the chosen item into local storage and it becomes visible in the UI.

---

## Primary Entry Point (Popup UI)
- **Button**: `extension/popup.html` → `#viewAvailableDevicesToSyncBtn`
- **Handler**: `extension/popup.js` → `setupManualDeviceSync()` / `refreshSyncDevices()` / `refreshSyncCandidates()`

Key flow:
- `refreshSyncDevices()`:
  - `pasteCraftSupabase.registerCurrentSyncDevice()`
  - `pasteCraftSupabase.listSyncDevices()` → renders device tabs
- `refreshSyncCandidates()`:
  - `pasteCraftSupabase.getDeviceSyncMetadata(activeDeviceId)` → rows
  - Filters out already-local via `content_hash` and `(origin_device_id:id)` heuristics
- Import:
  - `pasteCraftSupabase.getDeviceSyncData(deviceId, [{ itemType, itemId }])`
  - Adds to local arrays (`this.clips` / `this.categories` / `this.notes`) and persists

---

## Supabase Client Methods Used (Cross-Sync)
File: `extension/supabase-client.js`

### Device identity
- `getDeviceId()` uses `chrome.storage.local['pc_device_id_v1']`

### Device registration + listing
- `registerCurrentSyncDevice()` → upsert into `pastecraft_devices`
- `listSyncDevices()` → reads `pastecraft_devices` for same `user_id`, excludes current device

### Metadata + import payload
- `getDeviceSyncMetadata(remoteDeviceId)`:
  - Reads `clips`, `notes`, `categories` filtered by `user_id` + `device_id`
  - Returns trimmed preview + `content_hash` + `origin_device_id`
- `getDeviceSyncData(remoteDeviceId, itemRefs)`:
  - Fetches selected rows and returns `payload` (clip/note/category)

### Gating (most common “empty list” reason)
- `registerCurrentSyncDevice()`, `listSyncDevices()`, `getDeviceSyncMetadata()`, `getDeviceSyncData()` all require:
  - `userId = await getSyncUserId()`
  - `hasAccess = await hasCloudSyncAccess(userId)`
  - If access is false → returns `null` / `[]` / empty metadata **silently**

---

## “User ID” Selection (Must Match Across Devices)
File: `extension/supabase-client.js`

- `getSyncUserId()`:
  - If authenticated: uses Supabase `session.user.id` (auth UUID) and stores it in:
    - `chrome.storage.sync['accountUserId']`
    - `chrome.storage.local['chromeUserId']`
  - If not authenticated: uses `chrome.storage.sync['accountUserId']` else `chrome.storage.local['chromeUserId']`

Failure mode:
- Devices A/B are logged in but end up using **different `user_id`** (auth session not restored, legacy id, or storage sync off).

---

## Device Registration Timing (Discoverability)
File: `extension/popup.js`, `extension/supabase-client.js`

- Cross-device listing only works if each device has a row in `pastecraft_devices`.
- Device registration is best-effort and throttled; cross-sync can appear broken if **Device A never upserts**.

Recent change to ensure discoverability:
- `extension/popup.js`: on authenticated init, calls `pasteCraftSupabase.registerCurrentSyncDevice()` (best-effort).
- `extension/supabase-client.js`: before sync + queue processing, best-effort device register (cooldown).

If this still “does nothing”, the most likely blocker is **cloud-sync access gating** or **RLS/context** preventing reads/writes.

---

## DB Objects (Tables / RPC) Mentioned in Project Notes
From `implementation.md` (cross-sync entries):
- Tables: `pastecraft_devices`, `clips`, `notes`, `categories`
- RPC: `get_device_diff_clips` (indexed content-hash/device lookups)
- RPC: `get_effective_access_state` (owner/coupon/subscription access evaluation)

Important mismatch to verify:
- Popup manual device sync currently uses **direct selects** (`getDeviceSyncMetadata/getDeviceSyncData`),
  not the `get_device_diff_clips` RPC.
- If RLS is strict, direct selects may return empty while RPC succeeds.

---

## High-Probability Root Causes (Ranked)
1) **Cloud sync access gating returns false** → `listSyncDevices()` returns `[]`.
2) **Different `user_id` across devices** → devices/clips live under different accounts in DB.
3) **No `pastecraft_devices` rows** (registration never succeeds) → nothing to list.
4) **RLS / context not set** (`setUserContext` / `set_config` failures) → queries return empty/denied.
5) **Config/client not initialized** (Supabase CDN/config missing) → `this.client` null → returns empty defaults.

---

## What the Reviewer Should Check (Fast Evidence Checklist)
On Device B (popup console):
- Confirm Supabase client exists:
  - `pasteCraftSupabase?.client` is non-null
- Confirm cloud access is true:
  - `await pasteCraftSupabase.hasCloudSyncAccess(await pasteCraftSupabase.getSyncUserId())`
- Confirm a stable `user_id`:
  - `await pasteCraftSupabase.getSyncUserId()` matches on Device A and B
- Confirm device id is stable per device:
  - `await pasteCraftSupabase.getDeviceId()` differs across A vs B
- Confirm registration succeeds (no throw):
  - `await pasteCraftSupabase.registerCurrentSyncDevice()`
- Confirm the device list returns something:
  - `await pasteCraftSupabase.listSyncDevices()`

DB side (Supabase table view / logs):
- `pastecraft_devices`: 2 rows for same `user_id`, different `device_id`
- `clips`: rows for Device A have `device_id = A`, and correct `user_id`

---

## Files Most Relevant to Review
- `extension/popup.html` (button + modal)
- `extension/popup.js` (manual device sync UI logic + filtering)
- `extension/supabase-client.js` (device registry/listing + metadata/data + access gating)
- `db/supabase-schema.sql`, `db/supabase-fixes.sql` (tables/RPCs noted in `implementation.md`)
- `implementation.md` (cross-sync architecture notes)
- `bugfixes.md` (related fixes logged)

