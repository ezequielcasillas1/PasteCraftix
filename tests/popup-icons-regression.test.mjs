import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.attributes = new Map();
  }

  appendChild(child) {
    child.parentElement = this;
    child.setConnected?.(this.isConnected);
    this.children.push(child);
    return child;
  }

  setConnected(isConnected) {
    this.isConnected = isConnected;
    for (const child of this.children) child.setConnected?.(isConnected);
  }

  setAttribute(name, value = '') {
    this.attributes.set(name, String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelectorAll(selector) {
    if (selector !== '[data-lucide]') return [];
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.hasAttribute('data-lucide')) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body', 'body');
    this.readyState = 'complete';
    this.byId = new Map([['body', this.body]]);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.byId.get(id) || null;
  }

  registerElement(id, el) {
    el.id = id;
    this.byId.set(id, el);
    return el;
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener() {}
}

class FakeMutationObserver {
  observe() {}
}

function createIcon(name = 'clipboard') {
  const icon = new FakeElement('i');
  icon.setAttribute('data-lucide', name);
  return icon;
}

function markRendered(rootEl) {
  const render = (node) => {
    if (node.hasAttribute?.('data-lucide')) node.tagName = 'SVG';
    for (const child of node.children || []) render(child);
  };
  render(rootEl);
}

function installBrowserHarness() {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
    MutationObserver: globalThis.MutationObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const calls = [];
  const document = new FakeDocument();
  const requestAnimationFrame = (cb) => {
    cb();
    return 1;
  };

  globalThis.document = document;
  globalThis.Element = FakeElement;
  globalThis.MutationObserver = FakeMutationObserver;
  globalThis.requestAnimationFrame = requestAnimationFrame;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.window = {
    document,
    requestAnimationFrame,
    requestIdleCallback: undefined,
    lucide: {
      createIcons(options) {
        calls.push(options);
        markRendered(options.root);
      },
    },
  };

  return {
    calls,
    document,
    cleanup() {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    },
  };
}

function runBrowserScript(relativePath) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInThisContext(`(() => {\n${source}\n})();`, { filename: filePath });
}

async function withBrowserHarness(fn) {
  const harness = installBrowserHarness();
  try {
    return await fn(harness);
  } finally {
    harness.cleanup();
  }
}

describe('popup Lucide renderer regression', () => {
  test('finishBootLucideIcons renders body placeholders before reveal', async () => {
    await withBrowserHarness(async ({ calls, document }) => {
      document.body.appendChild(createIcon('clipboard'));
      window.__pcPopupLucideBooting = true;

      runBrowserScript('extension/popup/shared/popup-icons.js');
      window.finishBootLucideIcons();

      assert.equal(window.__pcPopupLucideBooting, false);
      assert.equal(window.__pcTabIconRendering, false);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].root, document.body);
      assert.deepEqual(calls[0].attrs, {
        'stroke-width': 2,
        'aria-hidden': 'true',
        focusable: 'false',
      });
    });
  });

  test('active tab flush renders only the selected tab root', async () => {
    await withBrowserHarness(async ({ calls, document }) => {
      const clipsTab = document.registerElement('clipsTab', new FakeElement('section'));
      const searchTab = document.registerElement('searchTab', new FakeElement('section'));
      clipsTab.appendChild(createIcon('copy'));
      searchTab.appendChild(createIcon('search'));
      document.body.appendChild(clipsTab);
      document.body.appendChild(searchTab);

      runBrowserScript('extension/popup/shared/popup-icons.js');
      window.renderLucideIconsForActiveTab('search', 'test', { immediate: true });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].root, searchTab);
      assert.equal(window.__pcTabIconRendering, false);
    });
  });

  test('dynamic scoped render queues a microtask for new placeholders', async () => {
    await withBrowserHarness(async ({ calls, document }) => {
      const listRoot = new FakeElement('div');
      listRoot.appendChild(createIcon('folder'));
      document.body.appendChild(listRoot);

      runBrowserScript('extension/popup/shared/popup-icons.js');
      window.renderLucideIcons(listRoot);
      assert.equal(calls.length, 0);

      await Promise.resolve();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].root, listRoot);
    });
  });

  test('tab rendering suppresses unscoped document scans but allows scoped sync paint', async () => {
    await withBrowserHarness(async ({ calls, document }) => {
      const scopedRoot = new FakeElement('div');
      scopedRoot.appendChild(createIcon('sparkles'));
      document.body.appendChild(createIcon('clipboard'));
      document.body.appendChild(scopedRoot);

      runBrowserScript('extension/popup/shared/popup-icons.js');
      window.__pcTabIconRendering = true;

      window.renderLucideIconsSync();
      assert.equal(calls.length, 0);

      window.renderLucideIconsSync(scopedRoot);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].root, scopedRoot);
    });
  });

  // Regression for nav-tab lag: the bundled lucide.createIcons ignores
  // `root`, scans the whole document, and re-emits `data-lucide` on every
  // SVG it produces — meaning each subsequent call rebuilds every previously
  // rendered icon (>1s jank with ~200 icons). The fix strips `data-lucide`
  // from rendered SVGs after each call so future calls only touch new
  // placeholders.
  test('rendered SVGs get data-lucide stripped after each createIcons call', async () => {
    await withBrowserHarness(async ({ calls, document }) => {
      document.body.appendChild(createIcon('clipboard'));
      document.body.appendChild(createIcon('search'));

      runBrowserScript('extension/popup/shared/popup-icons.js');
      window.finishBootLucideIcons();

      assert.equal(calls.length, 1);
      const renderedSvgs = document.body.children.filter((el) => el.tagName === 'SVG');
      assert.equal(renderedSvgs.length, 2, 'both placeholders should be rendered as SVGs');
      for (const svg of renderedSvgs) {
        assert.equal(
          svg.hasAttribute('data-lucide'),
          false,
          'rendered SVGs must have data-lucide stripped so subsequent createIcons calls do not rebuild them',
        );
      }
    });
  });

  test('subsequent renders only process new placeholders (no full-document rebuild)', async () => {
    await withBrowserHarness(async ({ calls, document }) => {
      const tabA = document.registerElement('clipsTab', new FakeElement('section'));
      tabA.appendChild(createIcon('copy'));
      tabA.appendChild(createIcon('trash-2'));
      document.body.appendChild(tabA);

      runBrowserScript('extension/popup/shared/popup-icons.js');
      window.finishBootLucideIcons();
      assert.equal(calls.length, 1);

      // Simulate a tab switch that re-renders content with new placeholders.
      const tabB = document.registerElement('searchTab', new FakeElement('section'));
      tabB.appendChild(createIcon('search'));
      document.body.appendChild(tabB);

      window.renderLucideIconsForActiveTab('search', 'tab-switch', { immediate: true, force: true });

      // The second call should run, but the previously-rendered SVGs in tabA
      // must not have `data-lucide` anymore (so they are invisible to lucide's
      // full-document scan and won't be rebuilt). The new placeholder in tabB
      // should be rendered as an SVG.
      assert.equal(calls.length, 2);
      const tabASvgs = tabA.children.filter((el) => el.tagName === 'SVG');
      assert.equal(tabASvgs.length, 2);
      for (const svg of tabASvgs) {
        assert.equal(
          svg.hasAttribute('data-lucide'),
          false,
          'icons rendered on prior calls must stay stripped to avoid full-doc re-renders',
        );
      }
    });
  });
});

describe('PasteCraftCRUD Lucide render hook', () => {
  test('runUiUpdater repaints icons inside the provided UI root', async () => {
    await withBrowserHarness(async ({ document }) => {
      const uiRoot = new FakeElement('div');
      const explicitRoot = new FakeElement('section');
      const renderCalls = [];
      let receivedMeta = null;
      document.body.appendChild(uiRoot);
      document.body.appendChild(explicitRoot);
      window.renderLucideIconsSync = (rootEl) => renderCalls.push(rootEl);

      runBrowserScript('extension/popup/shared/pastecraft-crud.js');
      window.PasteCraftCRUD.runUiUpdater((meta) => {
        receivedMeta = meta;
      }, { uiRoot }, explicitRoot, 'delete');

      assert.equal(receivedMeta.uiRoot, uiRoot);
      assert.deepEqual(renderCalls, [explicitRoot]);
    });
  });

  test('runUiUpdater does not repaint icons during boot or active tab rendering', async () => {
    await withBrowserHarness(async () => {
      const renderCalls = [];
      window.renderLucideIconsSync = (rootEl) => renderCalls.push(rootEl);

      runBrowserScript('extension/popup/shared/pastecraft-crud.js');
      window.__pcPopupLucideBooting = true;
      window.PasteCraftCRUD.runUiUpdater(() => {}, null, document.body, 'create');
      window.__pcPopupLucideBooting = false;
      window.__pcTabIconRendering = true;
      window.PasteCraftCRUD.runUiUpdater(() => {}, null, document.body, 'update');

      assert.equal(renderCalls.length, 0);
    });
  });

  test('deleteManyOperation normalizes duplicate ids and persists batch delete', async () => {
    await withBrowserHarness(async () => {
      const state = {
        clips: [
          { id: '1', text: 'alpha' },
          { id: '2', text: 'beta' },
          { id: '3', text: 'gamma' },
        ],
      };
      const persisted = [];
      const toastCalls = [];

      runBrowserScript('extension/popup/shared/pastecraft-crud.js');
      const result = await window.PasteCraftCRUD.deleteManyOperation({
        entityIds: [1, '2', '2', null, ''],
        entityType: 'clip',
        stateGetter: () => state,
        stateSetter: async (nextState) => {
          state.clips = nextState.clips;
        },
        stateKeys: ['clips'],
        storageKeys: ['clips'],
        storageWriter: async (data) => {
          persisted.push(data);
        },
        deleteFromArray: (items, idSet) => items.filter((item) => !idSet.has(String(item.id))),
        successMessage: (entities) => `Deleted ${entities.length} clips`,
        showToast: (message, type) => toastCalls.push({ message, type }),
      });

      assert.equal(result.success, true);
      assert.deepEqual(result.entities.map((entity) => entity.id), ['1', '2']);
      assert.deepEqual(state.clips.map((clip) => clip.id), ['3']);
      assert.equal(persisted.length, 1);
      assert.deepEqual(persisted[0].clips.map((clip) => clip.id), ['3']);
      assert.equal(typeof persisted[0].pc_local_updatedAt, 'number');
      assert.deepEqual(toastCalls, [{ message: 'Deleted 2 clips', type: 'success' }]);
    });
  });
});
