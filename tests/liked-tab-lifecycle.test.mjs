/**
 * Liked tab lifecycle: like on Clips → open Liked must show the clip.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { activatePopupTab } from '../extension/popup/features/app/popup.tab-lifecycle.js';
import { getClipIdKey } from '../extension/shared/clip-id.js';
import { filterLikedClips } from '../extension/shared/liked-clips.js';
import {
  getLikedClipsForApp,
  hydrateLikedTab,
  renderLikedPage,
  resolveLikedClipsForApp,
} from '../extension/popup/features/liked/liked.render.js';
import { toggleClipLike } from '../extension/popup/features/clips/clips.liked.js';

const originalDocument = globalThis.document;
const originalChrome = globalThis.chrome;
const originalWindow = globalThis.window;
const originalConsoleWarn = console.warn;

function createElement(id = null) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    disabled: false,
    dataset: {},
    style: {},
    classList: {
      values: new Set(),
      add(v) { this.values.add(v); },
      remove(v) { this.values.delete(v); },
      contains(v) { return this.values.has(v); },
      toggle(v, force) {
        if (force === true) this.values.add(v);
        else if (force === false) this.values.delete(v);
        else if (this.values.has(v)) this.values.delete(v);
        else this.values.add(v);
      },
    },
    setAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    appendChild() {},
    closest() { return null; },
  };
}

function installDom() {
  const nodes = new Map([
    ['likedClipsContainer', createElement('likedClipsContainer')],
    ['likedClipsCount', createElement('likedClipsCount')],
    ['likedCopyAllBtn', createElement('likedCopyAllBtn')],
    ['likedClearAllBtn', createElement('likedClearAllBtn')],
    ['likedTab', createElement('likedTab')],
    ['clipsTab', createElement('clipsTab')],
  ]);
  const likedBtn = createElement();
  likedBtn.dataset.tab = 'liked';
  const clipsBtn = createElement();
  clipsBtn.dataset.tab = 'clips';
  const buttons = [clipsBtn, likedBtn];

  globalThis.document = {
    getElementById(id) { return nodes.get(id) || null; },
    querySelectorAll(selector) {
      if (selector === '.tab-btn') return buttons;
      if (selector === '.tab-content') return [nodes.get('clipsTab'), nodes.get('likedTab')];
      return [];
    },
    querySelector(selector) {
      if (selector === '.tab-btn[data-tab="liked"]') return likedBtn;
      if (selector === '.tab-btn[data-tab="clips"]') return clipsBtn;
      return null;
    },
    createElement(tag) {
      const el = createElement();
      el.tagName = String(tag || '').toUpperCase();
      return el;
    },
  };
  globalThis.window = {
    renderLucideIconsSync() {},
    renderLucideIconsForActiveTab() {},
    __pcTabIconRendering: false,
  };
  console.warn = () => {};
  return { nodes };
}

function installChromeStore(initial = {}) {
  const store = { ...initial };
  const listeners = [];
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const key of list) out[key] = store[key];
          return out;
        },
        async set(obj) {
          const changes = {};
          for (const [key, value] of Object.entries(obj)) {
            changes[key] = { oldValue: store[key], newValue: value };
            store[key] = value;
          }
          for (const listener of listeners) listener(changes, 'local');
        },
      },
      onChanged: {
        addListener(fn) { listeners.push(fn); },
      },
    },
  };
  return store;
}

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.chrome = originalChrome;
  globalThis.window = originalWindow;
  console.warn = originalConsoleWarn;
});

test('like then Liked tab join finds float clip after IDB string roundtrip', async () => {
  installDom();
  installChromeStore({ likedClipIds: [] });

  const floatId = 1783808104361.236;
  const app = {
    clips: [{ id: String(floatId), text: 'float clip', timestamp: 1 }],
    searchOnlyClips: [],
    likedClipIds: new Set(),
    currentTab: 'clips',
    likedFeature: { render: { renderLikedPage, hydrateLikedTab } },
  };

  const liked = await toggleClipLike(app, getClipIdKey(floatId));
  assert.equal(liked, true);
  assert.equal(getLikedClipsForApp(app).length, 1);

  renderLikedPage(app);
  assert.equal(document.getElementById('likedClipsCount').textContent, '1 liked');
  assert.equal(
    document.getElementById('likedClipsContainer').innerHTML.includes('No liked clips yet'),
    false,
  );
});

test('activate Liked after like paints matched clips (not empty state)', async () => {
  const { nodes } = installDom();
  installChromeStore({ likedClipIds: [] });

  const floatId = 1783808104361.236;
  const app = {
    clips: [{ id: floatId, text: 'from clips', timestamp: 1 }],
    searchOnlyClips: [],
    likedClipIds: new Set(),
    currentTab: 'clips',
    likedFeature: { render: { renderLikedPage, hydrateLikedTab } },
    _saveActiveTabState() {},
    updateHeaderClipCount() {},
  };

  await toggleClipLike(app, getClipIdKey(floatId));
  await activatePopupTab(app, 'liked', { source: 'test' });

  assert.equal(app.currentTab, 'liked');
  assert.equal(nodes.get('likedClipsCount').textContent, '1 liked');
  assert.equal(nodes.get('likedClipsContainer').innerHTML.includes('No liked clips yet'), false);
});

test('hydrate merges in-memory like with storage ids', async () => {
  installDom();
  installChromeStore({ likedClipIds: ['from-storage'] });

  const app = {
    clips: [
      { id: 'from-storage', text: 'a' },
      { id: 'in-memory', text: 'b' },
    ],
    searchOnlyClips: [],
    likedClipIds: new Set(['in-memory']),
  };

  const ids = await hydrateLikedTab(app);
  assert.ok(ids.includes('from-storage'));
  assert.ok(ids.includes('in-memory'));
  assert.equal(filterLikedClips(app.clips, ids).length, 2);
});

test('storage fallback resolves liked clips missing from app.clips memory', async () => {
  installDom();
  installChromeStore({
    likedClipIds: ['only-in-storage'],
    clips: [{ id: 'only-in-storage', text: 'stored clip', timestamp: 1 }],
    searchOnlyClips: [],
  });

  const app = {
    clips: [],
    searchOnlyClips: [],
    likedClipIds: new Set(['only-in-storage']),
    currentTab: 'liked',
  };

  assert.equal(getLikedClipsForApp(app).length, 0);
  const resolved = await resolveLikedClipsForApp(app);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].text, 'stored clip');

  renderLikedPage(app);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(document.getElementById('likedClipsCount').textContent, '1 liked');
});

test('second Liked visit revalidates after a new like', async () => {
  const { nodes } = installDom();
  installChromeStore({ likedClipIds: [] });

  const app = {
    clips: [{ id: 'clip-a', text: 'A', timestamp: 1 }],
    searchOnlyClips: [],
    likedClipIds: new Set(),
    currentTab: 'clips',
    likedFeature: { render: { renderLikedPage, hydrateLikedTab } },
    _saveActiveTabState() {},
    updateHeaderClipCount() {},
  };

  await activatePopupTab(app, 'liked', { source: 'first' });
  assert.equal(nodes.get('likedClipsCount').textContent, '0 liked');

  app.currentTab = 'clips';
  await toggleClipLike(app, 'clip-a');
  await activatePopupTab(app, 'liked', { source: 'second' });
  assert.equal(nodes.get('likedClipsCount').textContent, '1 liked');
});
