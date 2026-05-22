import * as syncStorage from './sync.storage.js';
import * as syncConstants from './sync.constants.js';
import * as syncListener from './sync.listener.js';
import * as syncLoader from './sync.loader.js';
import * as syncRepair from './sync.repair.js';
import * as syncVisibility from './sync.visibility.js';

export function initSyncFeature(app) {
  return {
    storage: syncStorage,
    constants: syncConstants,
    listener: syncListener,
    loader: syncLoader,
    repair: syncRepair,
    visibility: syncVisibility,
  };
}
