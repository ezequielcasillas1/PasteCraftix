/**
 * Supabase composition root (Facade).
 *
 * Vertical modules:
 *   core/     — init, storage adapter, subscription/access, offline helper
 *   auth/     — auth, auth-bridge, identity, tombstones
 *   sync/     — queue, clips/notes/categories/archived/settings, full-sync, realtime
 *   ai/       — edge invoke, AI functions, workflow, history sync
 *   profile/  — profile sync + images
 *
 * Consumers: supabase-client.js + popup.boot → pasteCraftSupabase singleton.
 * Secrets: URL + anon only. Queries by user_id; setUserContext is a no-op (no set_config).
 */
import { PasteCraftSupabase } from './class.js';

import { coreMixin } from './core/core.js';
import { storageAdapterMixin } from './core/storage-adapter.js';
import { subscriptionMixin } from './core/subscription.js';

import { authMixin } from './auth/auth.js';
import { authBridgeMixin } from './auth/auth-bridge.js';
import { identityMixin } from './auth/identity.js';
import { tombstonesMixin } from './auth/tombstones.js';

import { syncQueueMixin } from './sync/sync-queue.js';
import { syncClipsMixin } from './sync/sync-clips.js';
import { syncCategoriesMixin } from './sync/sync-categories.js';
import { syncArchivedMixin } from './sync/sync-archived.js';
import { syncNotesMixin } from './sync/sync-notes.js';
import { syncSettingsMixin } from './sync/sync-settings.js';
import { fullSyncMixin } from './sync/full-sync.js';
import { realtimeMixin } from './sync/realtime.js';
import { clipImagesCloudMixin } from './sync/clip-images-cloud.js';

import { aiEdgeMixin } from './ai/ai-edge.js';
import { aiFunctionsMixin } from './ai/ai-functions.js';
import { aiWorkflowMixin } from './ai/ai-workflow.js';
import { aiHistorySyncMixin } from './ai/ai-history-sync.js';

import { profileImagesMixin } from './profile/profile-images.js';
import { profileSyncMixin } from './profile/profile-sync.js';

// Domains are disjoint; later assign wins only on accidental name overlap.
Object.assign(PasteCraftSupabase.prototype, storageAdapterMixin);
Object.assign(PasteCraftSupabase.prototype, coreMixin);
Object.assign(PasteCraftSupabase.prototype, subscriptionMixin);
Object.assign(PasteCraftSupabase.prototype, authBridgeMixin);
Object.assign(PasteCraftSupabase.prototype, authMixin);
Object.assign(PasteCraftSupabase.prototype, identityMixin);
Object.assign(PasteCraftSupabase.prototype, tombstonesMixin);
Object.assign(PasteCraftSupabase.prototype, syncQueueMixin);
Object.assign(PasteCraftSupabase.prototype, realtimeMixin);
Object.assign(PasteCraftSupabase.prototype, clipImagesCloudMixin);
Object.assign(PasteCraftSupabase.prototype, syncClipsMixin);
Object.assign(PasteCraftSupabase.prototype, syncCategoriesMixin);
Object.assign(PasteCraftSupabase.prototype, syncArchivedMixin);
Object.assign(PasteCraftSupabase.prototype, syncNotesMixin);
Object.assign(PasteCraftSupabase.prototype, syncSettingsMixin);
Object.assign(PasteCraftSupabase.prototype, fullSyncMixin);
Object.assign(PasteCraftSupabase.prototype, aiEdgeMixin);
Object.assign(PasteCraftSupabase.prototype, aiWorkflowMixin);
Object.assign(PasteCraftSupabase.prototype, aiFunctionsMixin);
Object.assign(PasteCraftSupabase.prototype, aiHistorySyncMixin);
Object.assign(PasteCraftSupabase.prototype, profileImagesMixin);
Object.assign(PasteCraftSupabase.prototype, profileSyncMixin);

export { PasteCraftSupabase };
export const pasteCraftSupabase = new PasteCraftSupabase();
