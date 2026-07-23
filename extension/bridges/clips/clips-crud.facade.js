/**
 * @forward-slice ACL — clip CRUD ops for popup/content slices.
 * Thin facade over PasteCraftCRUD; does not absorb business rules.
 */
import { getClipWriteCrud } from './clips-write.facade.js';

export function getClipsCrud() {
  return getClipWriteCrud();
}

export async function saveClipsState(options) {
  const crud = getClipWriteCrud();
  return crud.saveOperation(options);
}

export async function deleteClipEntity(options) {
  const crud = getClipWriteCrud();
  return crud.deleteOperation(options);
}

export async function deleteManyClipEntities(options) {
  const crud = getClipWriteCrud();
  return crud.deleteManyOperation(options);
}

export async function createClipEntity(options) {
  const crud = getClipWriteCrud();
  return crud.createOperation(options);
}

export async function updateClipEntity(options) {
  const crud = getClipWriteCrud();
  return crud.updateOperation(options);
}

export function snapshotClipValue(value) {
  return getClipWriteCrud().createSnapshot(value);
}

export async function retryClipOp(operation, maxRetries, baseDelay) {
  return getClipWriteCrud().retryOperation(operation, maxRetries, baseDelay);
}
