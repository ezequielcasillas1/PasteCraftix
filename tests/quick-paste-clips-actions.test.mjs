/**
 * PR #145 — Quick Paste qp.clips-actions + controller wiring.
 * Expands extension smoke coverage with behavior-level CRUD checks.
 *
 * Practices covered:
 * 1. Reusability — shared qp fixture + DOM/chrome mocks
 * 2. Reliability — storage writes asserted after delete/clear
 * 3. Secureness — delete/copy use existing clip ids (no client UUID minting)
 * 4. Accountability — toast + updateInterface called on mutate
 * 5. Accessibility — clear-all modal exposes cancel + confirm controls
 *
 * Run: node --test tests/quick-paste-clips-actions.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, before, describe } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const qpDir = path.join(root, 'extension/content/quick-paste');

/** Parse a tiny HTML subset into mock elements (ids/classes/buttons/divs). */
function hydrateFromHtml(parent, html) {
  const tagRe =
    /<(div|button|h3|p|strong)\b([^>]*)>([\s\S]*?)<\/\1>|<(div|button)\b([^>]*)\/>/gi;
  let m;
  while ((m = tagRe.exec(String(html || '')))) {
    const tag = (m[1] || m[4] || 'div').toLowerCase();
    const attrs = m[2] || m[5] || '';
    const inner = m[3] || '';
    const child = createEl(tag);
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const classMatch = attrs.match(/\bclass=["']([^"']+)["']/i);
    if (idMatch) child.id = idMatch[1];
    if (classMatch) {
      child.className = classMatch[1];
      classMatch[1].split(/\s+/).filter(Boolean).forEach((c) => child.classList.add(c));
    }
    if (inner && /</.test(inner)) hydrateFromHtml(child, inner);
    else child.textContent = inner.replace(/<[^>]+>/g, '').trim();
    parent.appendChild(child);
  }
}

/** Minimal element mock (reused across tests). */
function createEl(tag = 'div') {
  const children = [];
  const listeners = new Map();
  const classSet = new Set();
  let html = '';
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    style: {},
    dataset: {},
    disabled: false,
    textContent: '',
    offsetHeight: 0,
    parentNode: null,
    get children() {
      return children;
    },
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = String(value || '');
      children.length = 0;
      hydrateFromHtml(el, html);
    },
    classList: {
      add: (...xs) => xs.forEach((c) => classSet.add(c)),
      remove: (...xs) => xs.forEach((c) => classSet.delete(c)),
      contains: (c) => classSet.has(c),
    },
    setAttribute(name, value) {
      if (name === 'id') this.id = value;
      if (name === 'class') this.className = value;
    },
    appendChild(child) {
      child.parentNode = this;
      children.push(child);
      return child;
    },
    remove() {
      if (!this.parentNode) return;
      const sibs = this.parentNode.children;
      const i = sibs.indexOf(this);
      if (i >= 0) sibs.splice(i, 1);
      this.parentNode = null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    click() {
      (listeners.get('click') || []).forEach((fn) => fn({ target: this }));
    },
    querySelector(sel) {
      return queryIn(this, sel);
    },
    querySelectorAll(sel) {
      return queryAllIn(this, sel);
    },
  };
  return el;
}

function matchSel(el, sel) {
  if (!el || !sel) return false;
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (
      el.classList.contains(cls) ||
      String(el.className)
        .split(/\s+/)
        .filter(Boolean)
        .includes(cls)
    );
  }
  return false;
}

function walk(root, visit) {
  visit(root);
  for (const child of root.children || []) walk(child, visit);
}

function queryIn(root, sel) {
  // Support simple ".a.b" by requiring all classes
  const parts = String(sel).trim().split(/\s+/);
  if (parts.length === 1 && parts[0].includes('.') && !parts[0].startsWith('#')) {
    const classes = parts[0].split('.').filter(Boolean);
    let found = null;
    walk(root, (el) => {
      if (found) return;
      if (classes.every((c) => el.classList.contains(c) || String(el.className).split(/\s+/).includes(c))) {
        found = el;
      }
    });
    return found;
  }
  let found = null;
  walk(root, (el) => {
    if (!found && matchSel(el, sel)) found = el;
  });
  return found;
}

function queryAllIn(root, sel) {
  const out = [];
  const parts = String(sel).trim().split(/\s+/);
  if (parts.length === 1 && parts[0].includes('.') && !parts[0].startsWith('#')) {
    const classes = parts[0].split('.').filter(Boolean);
    walk(root, (el) => {
      if (classes.every((c) => el.classList.contains(c) || String(el.className).split(/\s+/).includes(c))) {
        out.push(el);
      }
    });
    return out;
  }
  walk(root, (el) => {
    if (matchSel(el, sel)) out.push(el);
  });
  return out;
}

function installBrowserMocks() {
  const storage = new Map();
  const body = createEl('body');
  globalThis.document = {
    body,
    createElement: (tag) => createEl(tag),
  };
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) {
            if (storage.has(k)) out[k] = storage.get(k);
          }
          return out;
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) storage.set(k, v);
        },
        _dump: () => Object.fromEntries(storage),
        _clear: () => storage.clear(),
      },
    },
    tabs: {
      query: (_q, cb) => {
        if (typeof cb === 'function') cb([]);
        return Promise.resolve([]);
      },
      sendMessage: async () => {},
    },
    runtime: {
      sendMessage: () => {},
    },
  };
  const clipboardWrites = [];
  const clipboard = {
    async writeText(text) {
      clipboardWrites.push(text);
    },
  };
  try {
    globalThis.navigator = { clipboard };
  } catch {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard },
      configurable: true,
      writable: true,
    });
  }
  if (!globalThis.navigator?.clipboard?.writeText) {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: clipboard,
      configurable: true,
      writable: true,
    });
  }
  return { storage, clipboardWrites, body };
}

function createQpFixture(overrides = {}) {
  const copyBtn = createEl('button');
  copyBtn.className = 'pastecraft-copy-multiple';
  copyBtn.disabled = true;
  copyBtn.textContent = 'Copy Multiple Clips';

  const container = createEl('div');
  container.className = 'pastecraft-quick-paste';
  container.appendChild(copyBtn);

  const clips = [
    { id: 'clip-a', text: 'Alpha', category: 'general', timestamp: 1 },
    { id: 'clip-b', text: 'Beta', category: 'general', timestamp: 2 },
    { id: 'clip-c', text: 'Gamma', category: 'general', timestamp: 3 },
  ];

  // Mirror DOM order for copy-multiple ordering
  for (const clip of clips) {
    const node = createEl('div');
    node.className = 'pastecraft-clip';
    node.dataset.clipId = String(clip.id);
    container.appendChild(node);
  }

  const toasts = [];
  const updates = [];
  const qp = {
    clips: clips.map((c) => ({ ...c })),
    selectedClips: new Set(),
    container,
    shadowMount: { root: container },
    settings: {
      theme: 'light',
      delimiter: 'comma',
      customDelimiter: ', ',
      options: { deduplicate: false, sort: false, uppercase: false },
    },
    _clipOpQueue: Promise.resolve(),
    _queueClipOp(fn) {
      const run = this._clipOpQueue.then(fn, fn);
      this._clipOpQueue = run.catch(() => {});
      return run;
    },
    updateInterface() {
      updates.push(this.clips.length);
    },
    showToast(message, type) {
      toasts.push({ message, type });
    },
    ...overrides,
  };
  return { qp, copyBtn, toasts, updates };
}

let actions;

before(async () => {
  installBrowserMocks();
  actions = await import(
    pathToFileURL(path.join(qpDir, 'qp.clips-actions.js')).href
  );
});

describe('PR145 module graph (known smoke expansion)', () => {
  test('qp slice files exist and entry re-exports controller', () => {
    const required = [
      'quick-paste.js',
      'qp.controller.js',
      'qp.clips-actions.js',
      'qp.constants.js',
      'qp.helpers.js',
    ];
    for (const f of required) {
      assert.ok(fs.existsSync(path.join(qpDir, f)), `missing ${f}`);
    }
    const entry = fs.readFileSync(path.join(qpDir, 'quick-paste.js'), 'utf8');
    assert.match(entry, /export\s*\{\s*QuickPasteInterface\s*\}\s*from\s*['"]\.\/qp\.controller\.js['"]/);
    const controller = fs.readFileSync(path.join(qpDir, 'qp.controller.js'), 'utf8');
    assert.match(controller, /from\s*['"]\.\/qp\.clips-actions\.js['"]/);
    assert.match(controller, /export\s+class\s+QuickPasteInterface/);
  });

  test('content.js still imports QuickPasteInterface via quick-paste entry', () => {
    const content = fs.readFileSync(
      path.join(root, 'extension/content/content.js'),
      'utf8',
    );
    assert.match(content, /from\s*['"]\.\/quick-paste\/quick-paste\.js['"]/);
    assert.match(content, /new\s+QuickPasteInterface\s*\(/);
  });

  test('manifest WAR includes content/quick-paste/*.js', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'),
    );
    const wars = (manifest.web_accessible_resources || []).flatMap(
      (g) => g.resources || [],
    );
    assert.ok(
      wars.some((r) => r.includes('quick-paste')),
      `WAR missing quick-paste glob: ${wars.join(',')}`,
    );
  });
});

describe('qp.clips-actions CRUD behavior', () => {
  test('toggle selection updates Copy Multiple button (reusable UI state)', () => {
    const { qp, copyBtn } = createQpFixture();
    const elA = createEl('div');
    elA.className = 'pastecraft-clip';
    actions.toggleQuickPasteClipSelection(qp, 'clip-a', elA);
    assert.equal(qp.selectedClips.has('clip-a'), true);
    assert.equal(copyBtn.disabled, true);

    const elB = createEl('div');
    elB.className = 'pastecraft-clip';
    actions.toggleQuickPasteClipSelection(qp, 'clip-b', elB);
    assert.equal(qp.selectedClips.size, 2);
    assert.equal(copyBtn.disabled, false);
    assert.match(copyBtn.textContent, /Copy 2 Clips/);
  });

  test('copy multiple joins selected texts and clears selection (reliable write)', async () => {
    const { clipboardWrites } = installBrowserMocks();
    // re-bind document body after reinstall
    const { qp } = createQpFixture();
    qp.selectedClips.add('clip-a');
    qp.selectedClips.add('clip-c');
    actions.updateQuickPasteCopyMultipleButton(qp);

    await actions.copyMultipleQuickPasteClips(qp);
    assert.equal(clipboardWrites.length, 1);
    assert.equal(clipboardWrites[0], 'Alpha, Gamma');
    assert.equal(qp.selectedClips.size, 0);
  });

  test('delete by id persists remaining clips without minting ids (secure + accountable)', async () => {
    installBrowserMocks();
    const { qp, toasts, updates } = createQpFixture();
    await actions.deleteQuickPasteClipById(qp, 'clip-b');
    assert.deepEqual(
      qp.clips.map((c) => c.id),
      ['clip-a', 'clip-c'],
    );
    const dumped = globalThis.chrome.storage.local._dump();
    assert.equal(dumped.clips.length, 2);
    assert.ok(!dumped.clips.some((c) => c.id === 'clip-b'));
    // No client-generated entity ids introduced
    for (const clip of dumped.clips) {
      assert.ok(typeof clip.id === 'string' && clip.id.startsWith('clip-'));
    }
    assert.ok(updates.length >= 1);
    assert.ok(toasts.some((t) => t.type === 'success' && /Deleted clip/i.test(t.message)));
  });

  test('delete by index delegates to id path', async () => {
    installBrowserMocks();
    const { qp } = createQpFixture();
    await actions.deleteQuickPasteClip(qp, 0);
    assert.equal(qp.clips.length, 2);
    assert.equal(qp.clips[0].id, 'clip-b');
  });

  test('clear-all confirm modal is accessible (cancel + confirm ids)', () => {
    installBrowserMocks();
    const { qp } = createQpFixture();
    actions.showQuickPasteClearAllConfirmation(qp);
    const modal = qp.shadowMount.root.querySelector('.pastecraft-confirm-modal');
    assert.ok(modal, 'confirm modal mounted');
    const cancel = modal.querySelector('#cancelClearAll');
    const confirm = modal.querySelector('#confirmClearAll');
    assert.ok(cancel, 'cancel control present');
    assert.ok(confirm, 'confirm control present');
    cancel.click();
    assert.equal(
      qp.shadowMount.root.querySelector('.pastecraft-confirm-modal'),
      null,
      'cancel removes modal',
    );
  });

  test('clear all empties storage + local state (reliable clear)', async () => {
    installBrowserMocks();
    const { qp, toasts } = createQpFixture();
    await globalThis.chrome.storage.local.set({
      clips: qp.clips,
      searchOnlyClips: [{ id: 'arch-1', text: 'x' }],
    });
    await actions.clearAllQuickPasteClips(qp);
    assert.equal(qp.clips.length, 0);
    const dumped = globalThis.chrome.storage.local._dump();
    assert.deepEqual(dumped.clips, []);
    assert.deepEqual(dumped.searchOnlyClips, []);
    assert.ok(toasts.some((t) => /All clips deleted/i.test(t.message)));
  });
});

describe('controller thin-delegate surface', () => {
  test('qp.controller.js delegates clip actions to qp.clips-actions exports', () => {
    const src = fs.readFileSync(path.join(qpDir, 'qp.controller.js'), 'utf8');
    const requiredCalls = [
      'showQuickPasteClearAllConfirmation',
      'clearAllQuickPasteClips',
      'toggleQuickPasteClipSelection',
      'updateQuickPasteCopyMultipleButton',
      'copyMultipleQuickPasteClips',
      'deleteQuickPasteClip',
      'deleteQuickPasteClipById',
    ];
    for (const name of requiredCalls) {
      assert.match(src, new RegExp(name), `controller missing ${name}`);
    }
    // Thin methods exist on class
    for (const method of [
      'showClearAllConfirmation',
      'clearAllClips',
      'toggleClipSelection',
      'copyMultipleClips',
      'deleteClip',
      'deleteClipById',
    ]) {
      assert.match(src, new RegExp(`${method}\\s*\\(`), `missing method ${method}`);
    }
  });
});
