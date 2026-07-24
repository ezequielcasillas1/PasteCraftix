/** @forward-slice Local library → Supabase upload after cloud-sync entitlement. */

export const LOCAL_TO_CLOUD_STORAGE_KEYS = Object.freeze({
  MIGRATED_MAP: 'pc_local_to_cloud_migrated_v1',
});

export const LOCAL_TO_CLOUD_TOAST = Object.freeze({
  START: '☁️ Uploading your local library to the cloud…',
  SUCCESS: '✅ Local library uploaded to cloud sync',
  FAILURE: '❌ Cloud upload failed — will retry next open, or reopen PasteCraft to retry',
});

export const LOCAL_TO_CLOUD_VERSION = 1;
