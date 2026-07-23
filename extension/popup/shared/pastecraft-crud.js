/**
 * @forward-slice PasteCraftCRUD facade — wires shared crud ops + local/IDB paths.
 * Loaded via popup.boot (ESM); assigns globalThis.PasteCraftCRUD for legacy callers.
 */
import {
  retryOperation,
  createSnapshot,
  restoreSnapshot,
  renderLucideIconsAfterUi,
  runUiUpdater,
} from './crud/crud.core.js';
import {
  deleteOperation,
  deleteManyOperation,
} from './crud/crud.delete.js';
import { saveOperation } from './crud/crud.save.js';
import { createOperation } from './crud/crud.create.js';
import { updateOperation } from './crud/crud.update.js';

class PasteCraftCRUD {
  static async retryOperation(operation, maxRetries = 3, baseDelay = 100) {
    return retryOperation(operation, maxRetries, baseDelay);
  }

  static createSnapshot(data) {
    return createSnapshot(data);
  }

  static restoreSnapshot(target, snapshot) {
    return restoreSnapshot(target, snapshot);
  }

  static renderLucideIconsAfterUi(meta, iconRoot, crudOp) {
    return renderLucideIconsAfterUi(meta, iconRoot, crudOp);
  }

  static runUiUpdater(uiUpdater, meta, iconRoot, crudOp) {
    return runUiUpdater(uiUpdater, meta, iconRoot, crudOp);
  }

  static async deleteOperation(options) {
    return deleteOperation(options);
  }

  static async deleteManyOperation(options) {
    return deleteManyOperation(options);
  }

  static async saveOperation(options) {
    return saveOperation(options);
  }

  static async createOperation(options) {
    return createOperation(options);
  }

  static async updateOperation(options) {
    return updateOperation(options);
  }
}

export { PasteCraftCRUD };

const scope = typeof globalThis !== 'undefined' ? globalThis : undefined;
if (scope) scope.PasteCraftCRUD = PasteCraftCRUD;
if (typeof window !== 'undefined') window.PasteCraftCRUD = PasteCraftCRUD;
