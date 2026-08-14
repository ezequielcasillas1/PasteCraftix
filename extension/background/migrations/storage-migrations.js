/**
 * @forward-slice Storage schema version + migration registry.
 * See .cursor/rules/production-publishing-safety.mdc Sections D and E.
 */

import { migrateClipImagesFromChromeStorage } from '../../shared/clip-images.js';

export const SCHEMA_VERSION = 2;
export const SCHEMA_VERSION_KEY = '__schemaVersion';

const migrations = {
  1: async () => {
    await migrateClipImagesFromChromeStorage();
  },
};

export async function runStorageMigrations(previousVersion) {
  try {
    const stored = await chrome.storage.local.get(SCHEMA_VERSION_KEY);
    const from = typeof stored[SCHEMA_VERSION_KEY] === 'number' ? stored[SCHEMA_VERSION_KEY] : 0;
    if (from >= SCHEMA_VERSION) {
      return { ok: true, from, to: SCHEMA_VERSION, ran: [] };
    }
    const ran = [];
    for (let v = from; v < SCHEMA_VERSION; v++) {
      const step = migrations[v];
      if (typeof step === 'function') {
        await step();
        ran.push(v);
      }
    }
    await chrome.storage.local.set({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
    console.log(`[migration] ok previousVersion=${previousVersion || 'unknown'} from=${from} to=${SCHEMA_VERSION} ran=${JSON.stringify(ran)}`);
    return { ok: true, from, to: SCHEMA_VERSION, ran };
  } catch (e) {
    // Never wipe local data on failure. Flag cloud re-hydration via Supabase on next login.
    console.error('[migration] failed — will fall back to cloud rehydrate on next login', e);
    try {
      await chrome.storage.local.set({ __migrationFailed: true, __migrationFailedAt: Date.now() });
    } catch (_) {}
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}
