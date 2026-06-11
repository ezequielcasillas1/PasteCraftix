/**
 * Album interlayings CRUD unit tests.
 * Run: node --test tests/album-interlayings-crud.test.mjs
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const crudUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/notes/notes.album-interlayings.crud.js')
).href;

const {
  collectAlbumInterlayings,
  countAlbumInterlayings,
  patchInterlayingAtFlatIndex,
  resolveInterlayingAtFlatIndex,
  removeInterlayingAtFlatIndex,
  syncAlbumRefMetadata,
  mergeSourceNoteIntoAlbumDraft
} = await import(crudUrl);

describe('album interlayings CRUD', () => {
  test('collect and resolve flat index order clips → images → urls', () => {
    const album = {
      type: 'album',
      clips: [{ id: 1, text: 'a' }],
      images: [{ id: 2, url: 'img' }],
      urls: [{ id: 3, url: 'http://x' }]
    };
    const flat = collectAlbumInterlayings(album);
    assert.equal(flat.length, 3);
    assert.equal(resolveInterlayingAtFlatIndex(album, 0).bucket, 'clips');
    assert.equal(resolveInterlayingAtFlatIndex(album, 1).bucket, 'images');
    assert.equal(resolveInterlayingAtFlatIndex(album, 2).bucket, 'urls');
  });

  test('delete interlaying cleans sourceNoteIds and noteRefs', () => {
    const album = {
      type: 'album',
      clips: [{ id: 1, text: 'only', sourceNoteId: 99 }],
      urls: [],
      images: [],
      sourceNoteIds: [99],
      noteRefs: [99]
    };
    removeInterlayingAtFlatIndex(album, 0);
    syncAlbumRefMetadata(album);
    assert.equal(album.clips.length, 0);
    assert.equal(album.sourceNoteIds.length, 0);
    assert.equal(album.noteRefs.length, 0);
  });

  test('count uses attachments when noteRefs empty', () => {
    const album = { type: 'album', clips: [{ id: 1 }], urls: [], images: [], noteRefs: [] };
    assert.equal(countAlbumInterlayings(album), 1);
  });

  test('merge source note adds noteRefs', () => {
    const album = { type: 'album', clips: [], urls: [], images: [], noteRefs: [], sourceNoteIds: [] };
    const source = {
      id: 42,
      type: 'note',
      title: 'Src',
      body: 'Body',
      clips: [{ id: 10, text: 'clip' }],
      urls: [],
      images: []
    };
    mergeSourceNoteIntoAlbumDraft(album, source);
    assert.ok(album.noteRefs.includes(42));
    assert.ok(album.sourceNoteIds.includes(42));
    assert.ok(album.clips.length >= 2);
  });

  test('patch interlaying updates correct flat-index bucket and refs', () => {
    const album = {
      type: 'album',
      clips: [{ id: 'clip-1', text: 'clip', sourceNoteId: 11 }],
      images: [{ id: 'image-1', alt: 'old', sourceNoteId: 22 }],
      urls: [{ id: 'url-1', url: 'https://old.example', sourceNoteId: 33 }],
      sourceNoteIds: [11, 22, 33],
      noteRefs: [11, 22, 33]
    };

    patchInterlayingAtFlatIndex(album, 1, {
      alt: 'new',
      sourceNoteId: 33
    });

    assert.equal(album.clips[0].text, 'clip');
    assert.equal(album.images[0].alt, 'new');
    assert.equal(album.images[0].sourceNoteId, 33);
    assert.equal(album.urls[0].url, 'https://old.example');
    assert.deepEqual(album.sourceNoteIds, [11, 33]);
    assert.deepEqual(album.noteRefs, [11, 33]);

    patchInterlayingAtFlatIndex(album, 10, { text: 'no-op' });
    patchInterlayingAtFlatIndex(album, 0, null);
    assert.equal(album.clips[0].text, 'clip');
  });
});
