import * as syncStorage from './sync.storage.js';
import * as syncConstants from './sync.constants.js';
import * as syncListener from './sync.listener.js';
import * as syncLoader from './sync.loader.js';

export function initSyncFeature(app) {
  return {
    storage: syncStorage,
    constants: syncConstants,
    listener: syncListener,
    loader: syncLoader
  };
}
