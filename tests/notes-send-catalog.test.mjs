/**
 * Notes send catalog unit tests.
 * Run: node --test tests/notes-send-catalog.test.mjs
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/notes/notes.send-catalog.js')
).href;
const adapterUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/categories/categories.notes-send.js')
).href;

const { normalizeClipsForNotes, queueClipsForNotes } = await import(catalogUrl);
const { sendCategoryToNotes } = await import(adapterUrl);

function makeApp(overrides = {}) {
  return {
    clips: [],
    searchOnlyClips: [],
    pendingClipForNotes: 'stale',
    pendingBulkClipsForNotes: 'stale',
    pendingNoteForAlbum: { id: 1 },
    toasts: [],
    pickerShown: false,
    notesLoaded: false,
    async loadNotes() { this.notesLoaded = true; },
    showAlbumPicker() { this.pickerShown = true; },
    showToast(message, type) { this.toasts.push({ message, type }); },
    async queueClipsForNotes(clips, options) {
      return queueClipsForNotes(this, clips, options);
    },
    ...overrides,
  };
}

describe('notes send catalog', () => {
  test('normalize drops clips without ids', () => {
    const clips = [{ id: 1, text: 'a' }, { text: 'no-id' }, null];
    assert.deepEqual(normalizeClipsForNotes(clips).map((c) => c.id), [1]);
  });

  test('single clip queues pendingClipForNotes and opens picker', async () => {
    const app = makeApp();
    const clip = { id: 7, text: 'hello' };
    const ok = await queueClipsForNotes(app, [clip]);
    assert.equal(ok, true);
    assert.equal(app.notesLoaded, true);
    assert.equal(app.pickerShown, true);
    assert.equal(app.pendingClipForNotes, clip);
    assert.equal(app.pendingBulkClipsForNotes, null);
    assert.equal(app.pendingNoteForAlbum, null);
  });

  test('multiple clips queue bulk pending', async () => {
    const app = makeApp();
    const clips = [{ id: 1 }, { id: 2 }];
    const ok = await queueClipsForNotes(app, clips);
    assert.equal(ok, true);
    assert.equal(app.pendingClipForNotes, null);
    assert.equal(app.pendingBulkClipsForNotes.length, 2);
  });

  test('empty payload toasts and does not open picker', async () => {
    const app = makeApp();
    const ok = await queueClipsForNotes(app, []);
    assert.equal(ok, false);
    assert.equal(app.pickerShown, false);
    assert.equal(app.toasts[0].type, 'error');
  });
});

describe('category notes adapter', () => {
  test('sends all clips in that category through the catalog', async () => {
    const app = makeApp({
      clips: [
        { id: 1, category: 'Chapter 4', text: 'a' },
        { id: 2, category: 'Other', text: 'b' },
        { id: 3, category: 'Chapter 4', text: 'c' },
      ],
    });
    const ok = await sendCategoryToNotes(app, { name: 'Chapter 4' });
    assert.equal(ok, true);
    assert.equal(app.pendingBulkClipsForNotes.length, 2);
    assert.deepEqual(app.pendingBulkClipsForNotes.map((c) => c.id), [1, 3]);
  });

  test('empty category toasts with category name', async () => {
    const app = makeApp({ clips: [{ id: 1, category: 'Other' }] });
    const ok = await sendCategoryToNotes(app, { name: 'Chapter 4' });
    assert.equal(ok, false);
    assert.match(app.toasts[0].message, /Chapter 4/);
  });
});
