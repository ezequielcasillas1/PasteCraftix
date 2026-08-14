/**
 * @forward-slice Background facade — re-exports Command modules + loads menu/update lifecycle.
 * Prefer importing from handlers/quickview/migrations directly in new code.
 * Arkitect seams: Facade (this file) + Mediator (messaging/router) + Command (handlers).
 */

import './handlers/menus.handler.js';
import './handlers/update.handler.js';

export {
  isRepoLoaderBuild,
  getExtensionPageUrl,
  normalizeArray,
  safeTabsSendMessage,
  getAppOpenMode,
  openAppPopupWindow,
} from './handlers/bg-utils.js';

export {
  hashTextForQuickView,
  normalizeQuickViewClip,
} from './quickview/quickview.normalize.js';

export {
  readIndexedDbPayloads,
  syncClipsToIndexedDb,
} from './quickview/quickview.idb.js';

export {
  getQuickViewClips,
  deleteQuickViewClip,
} from './quickview/quickview.service.js';

export {
  sanitizeClipMeta,
  saveTextDirectly,
  pasteClip,
} from './handlers/clips.commands.js';

export {
  createContextMenus,
} from './handlers/menus.handler.js';

export {
  runStorageMigrations,
  SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
} from './migrations/storage-migrations.js';
