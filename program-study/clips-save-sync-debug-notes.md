# Clips Not Saving – Debug Notes & Potential Fix

**Context:** User reported clips not saving; suspected sync issues. Investigation found the app was working—the website they were on did not permit saving (e.g., clipboard/content-script restrictions).

## Hypotheses Investigated

| ID | Hypothesis | Status |
|----|------------|--------|
| A | `performFullSync` uses stale local read at start; overwrites storage with merge that drops clips saved during sync | Potential race |
| B | `handleClipsChange` (Supabase realtime) overwrites local with remote merge, losing newer local clips | Possible |
| C | `chrome.storage.local.set` fails (quota/permission) | Ruled out (app works elsewhere) |
| D | `bootstrapStorageSyncTransfer` prefers sync backup over local, overwriting with older backup | Possible |

## Potential Fix (Hypothesis A)

**Location:** `extension/supabase-client.js` → `performFullSync()`

**Issue:** Local clips are read once at the start. After sync (push + pull + merge), the code writes `mergedClips` to storage. Any clips saved *during* the sync are not in that stale snapshot and get overwritten.

**Fix idea:** Before writing merged clips, re-read current storage and merge again so clips saved during sync are preserved:

```javascript
// Before: chrome.storage.local.set({ clips: mergedClips }, resolve);
// After: Re-read fresh local, merge with our result, then write
const fresh = await new Promise(r => chrome.storage.local.get(['clips'], r));
const freshLocal = fresh?.clips || [];
const finalMerged = await this.mergeClips(freshLocal, mergedClips);
await new Promise((resolve) => {
  chrome.storage.local.set({ clips: finalMerged }, resolve);
});
```

Apply same pattern for `searchOnlyClips`, `categories`, `notes` if needed.

## Notes

- If clips fail only on certain sites, it is likely a content-script/clipboard permission issue, not sync.
- Instrumentation can be re-added if sync-related loss is observed again.
