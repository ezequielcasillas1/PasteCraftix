/**
 * Run: node --test tests/notes-ai-output-save.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { saveCurrentAiOutputToNotes } from '../extension/popup/features/notes/notes.editor.js';
import { normalizeAiTaskOutputArtifact } from '../extension/popup/shared/ai-output-bridge.js';

function createApp({ artifact = null } = {}) {
  const calls = {
    loadNotes: 0,
    showAlbumPicker: 0,
    toasts: [],
  };
  return {
    calls,
    pendingBulkClipsForNotes: [{ id: 'old-bulk' }],
    pendingClipForNotes: null,
    getAiTaskOutputArtifact() {
      return artifact;
    },
    async loadNotes() {
      calls.loadNotes += 1;
    },
    showAlbumPicker() {
      calls.showAlbumPicker += 1;
    },
    showToast(message, type) {
      calls.toasts.push({ message, type });
    },
  };
}

test('saveCurrentAiOutputToNotes reports when no AI output is ready', async () => {
  const app = createApp();

  await saveCurrentAiOutputToNotes(app);

  assert.equal(app.pendingClipForNotes, null);
  assert.deepEqual(app.pendingBulkClipsForNotes, [{ id: 'old-bulk' }]);
  assert.equal(app.calls.loadNotes, 0);
  assert.equal(app.calls.showAlbumPicker, 0);
  assert.deepEqual(app.calls.toasts, [
    { message: 'No AI output ready to save', type: 'error' },
  ]);
});

test('saveCurrentAiOutputToNotes stages AI artifact clip for album picker', async () => {
  const originalNow = Date.now;
  Date.now = () => 1710000001234;
  try {
    const artifact = normalizeAiTaskOutputArtifact({
      artifactId: 'artifact-2',
      source: 'magic',
      taskType: 'craft',
      title: 'Crafted clip',
      outputText: 'Use this in notes.',
      createdAt: 1710000000000,
    });
    const app = createApp({ artifact });

    await saveCurrentAiOutputToNotes(app);

    assert.equal(app.calls.loadNotes, 1);
    assert.equal(app.calls.showAlbumPicker, 1);
    assert.equal(app.pendingBulkClipsForNotes, null);
    assert.equal(app.pendingClipForNotes.id, `ai-artifact-${artifact.artifactHash}`);
    assert.equal(app.pendingClipForNotes.title, 'Crafted clip');
    assert.equal(app.pendingClipForNotes.meta.aiTaskOutput, true);
    assert.equal(app.pendingClipForNotes.meta.aiTaskType, 'craft');
    assert.deepEqual(app.calls.toasts, [
      { message: 'Select a note or album for this AI output', type: undefined },
    ]);
  } finally {
    Date.now = originalNow;
  }
});
