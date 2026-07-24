import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extensionDir = path.join(root, 'extension');
const originals = {
  chrome: globalThis.chrome,
  pdfjsLib: globalThis.pdfjsLib,
  PasteCraftResourceLoader: globalThis.PasteCraftResourceLoader,
};

afterEach(() => {
  globalThis.chrome = originals.chrome;
  globalThis.pdfjsLib = originals.pdfjsLib;
  globalThis.PasteCraftResourceLoader = originals.PasteCraftResourceLoader;
});

function readExtensionFile(relativePath) {
  return fs.readFileSync(path.join(extensionDir, relativePath), 'utf8');
}

function createClassicContext(overrides = {}) {
  const context = {
    console,
    Map,
    Promise,
    Set,
    URL,
    ...overrides,
  };
  context.window = context;
  return context;
}

/** Load PCMarkup Strategy modules + thin facade (shared/markup/markup.load-order.js). */
function loadPCMarkupModules(context) {
  const sandbox = vm.createContext(context);
  vm.runInContext(readExtensionFile('shared/markup/markup.load-order.js'), sandbox);
  const order = sandbox.__PCMarkupLoadOrder;
  assert.ok(Array.isArray(order) && order.length > 0, 'PCMarkup load order missing');
  for (const relativePath of order) {
    vm.runInContext(readExtensionFile(relativePath), sandbox);
  }
  return sandbox;
}

test('PDF and Mermaid are absent from eager popup scripts', () => {
  const html = readExtensionFile('popup.html');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);

  assert.ok(scripts.includes('popup/shared/resource-loader.js'));
  assert.equal(scripts.includes('lib/pdf.min.js'), false);
  assert.equal(scripts.includes('lib/mermaid.min.js'), false);
  assert.ok(
    scripts.indexOf('popup/shared/resource-loader.js') < scripts.indexOf('markup-renderer.js'),
  );
});

test('local resource loader deduplicates and retries failed scripts', async () => {
  const appended = [];
  const document = {
    baseURI: 'chrome-extension://test/popup.html',
    createElement() {
      return {
        dataset: {},
        remove() { this.removed = true; },
      };
    },
    head: {
      appendChild(script) { appended.push(script); },
    },
  };
  const context = createClassicContext({
    chrome: { runtime: { getURL: (value) => `chrome-extension://test/${value}` } },
    document,
  });
  vm.runInNewContext(readExtensionFile('popup/shared/resource-loader.js'), context);

  const first = context.PasteCraftResourceLoader.loadScript('pdf');
  const second = context.PasteCraftResourceLoader.loadScript('pdf');
  assert.equal(first, second);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, 'chrome-extension://test/lib/pdf.min.js');

  context.pdfjsLib = { loaded: true };
  appended[0].onload();
  assert.equal(await first, context.pdfjsLib);

  const failed = context.PasteCraftResourceLoader.loadScript('mermaid');
  appended[1].onerror();
  await assert.rejects(failed, /Failed to load extension resource/);

  const retry = context.PasteCraftResourceLoader.loadScript('mermaid');
  assert.equal(appended.length, 3);
  context.mermaid = { loaded: true };
  appended[2].onload();
  assert.equal(await retry, context.mermaid);

  await assert.rejects(
    context.PasteCraftResourceLoader.loadScript('https://example.com/evil.js'),
    /Unsupported extension resource/,
  );
  assert.equal(appended.length, 3);
});

test('PDF library loads only when extraction first runs', async () => {
  let loadCalls = 0;
  globalThis.chrome = {
    runtime: {
      getURL: (value) => `chrome-extension://test/${value}`,
    },
  };
  globalThis.pdfjsLib = undefined;
  globalThis.PasteCraftResourceLoader = {
    async loadScript(name) {
      loadCalls += 1;
      assert.equal(name, 'pdf');
      globalThis.pdfjsLib = {
        GlobalWorkerOptions: {},
        getDocument: () => ({
          promise: Promise.resolve({ numPages: 0 }),
        }),
      };
      return globalThis.pdfjsLib;
    },
  };

  const moduleUrl = `${pathToFileURL(
    path.join(extensionDir, 'popup/features/clips/clips.pdf.js'),
  ).href}?lazy-pdf-test=${Date.now()}`;
  const { extractPdfText } = await import(moduleUrl);
  assert.equal(loadCalls, 0);

  const result = await extractPdfText(new ArrayBuffer(0));

  assert.equal(loadCalls, 1);
  assert.deepEqual(result.pages, []);
  assert.equal(
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc,
    'chrome-extension://test/lib/pdf.worker.min.js',
  );
});

function createEscapingDocument() {
  return {
    createElement() {
      let text = '';
      return {
        set textContent(value) { text = String(value ?? ''); },
        get innerHTML() {
          return text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
        },
      };
    },
  };
}

test('Mermaid loads on first diagram and initializes with strict security', async () => {
  let loadCalls = 0;
  let initializeOptions = null;
  const context = createClassicContext({
    document: createEscapingDocument(),
    DOMPurify: { sanitize: (value) => value },
    PasteCraftResourceLoader: {
      async loadScript(name) {
        loadCalls += 1;
        assert.equal(name, 'mermaid');
        context.mermaid = {
          initialize(options) { initializeOptions = options; },
          parse: async () => true,
          render: async () => ({ svg: '<svg class="diagram"></svg>' }),
        };
      },
    },
  });
  loadPCMarkupModules(context);
  assert.equal(loadCalls, 0);

  const first = await context.PCMarkup.renderMarkup(
    'graph TD\nA-->B',
    null,
    { type: 'mermaid' },
  );
  const second = await context.PCMarkup.renderMarkup(
    'graph TD\nB-->C',
    null,
    { type: 'mermaid' },
  );

  assert.match(first, /pc-mermaid-rendered/);
  assert.match(second, /pc-mermaid-rendered/);
  assert.equal(loadCalls, 1);
  assert.equal(initializeOptions.securityLevel, 'strict');
  assert.equal(initializeOptions.startOnLoad, false);
  assert.equal(initializeOptions.htmlLabels, false);
});

test('Mermaid load failures fall back to escaped local code', async () => {
  const context = createClassicContext({
    document: createEscapingDocument(),
    PasteCraftResourceLoader: {
      async loadScript() {
        throw new Error('missing local Mermaid asset');
      },
    },
  });
  loadPCMarkupModules(context);

  const result = await context.PCMarkup.renderMarkup(
    'graph TD\nA["<unsafe>"]',
    null,
    { type: 'mermaid' },
  );

  assert.match(result, /pc-code-block/);
  assert.match(result, /&lt;unsafe&gt;/);
  assert.doesNotMatch(result, /<unsafe>/);
});

function createFakeElement({ id = '', icon = '', classes = [] } = {}) {
  const attributes = new Map();
  if (icon) attributes.set('data-lucide', icon);
  const classNames = new Set(classes);
  const element = {
    id,
    nodeType: 1,
    tagName: icon ? 'I' : 'DIV',
    children: [],
    parentElement: null,
    isConnected: true,
    classList: {
      add: (name) => classNames.add(name),
      remove: (name) => classNames.delete(name),
      contains: (name) => classNames.has(name),
    },
    appendChild(child) {
      child.parentElement = element;
      element.children.push(child);
    },
    contains(candidate) {
      if (candidate === element) return true;
      return element.children.some((child) => child.contains(candidate));
    },
    closest(selector) {
      let current = element;
      while (current) {
        if (selector === '.tab-content' && current.classList.contains('tab-content')) return current;
        current = current.parentElement;
      }
      return null;
    },
    getAttribute: (name) => attributes.get(name) ?? null,
    hasAttribute: (name) => attributes.has(name),
    removeAttribute: (name) => attributes.delete(name),
    setAttribute: (name, value) => attributes.set(name, String(value)),
    querySelectorAll(selector) {
      const found = [];
      const visit = (node) => {
        node.children.forEach((child) => {
          const matchesPlaceholder = selector === '[data-lucide]' && child.hasAttribute('data-lucide');
          const matchesSvg = selector === 'svg[data-lucide]'
            && child.tagName === 'SVG'
            && child.hasAttribute('data-lucide');
          if (matchesPlaceholder || matchesSvg) found.push(child);
          visit(child);
        });
      };
      visit(element);
      return found;
    },
  };
  return element;
}

test('initial Lucide conversion excludes hidden tabs until activation', () => {
  const body = createFakeElement({ id: 'body' });
  const topBar = createFakeElement({ id: 'topBar' });
  const header = createFakeElement({ classes: ['header'] });
  const nav = createFakeElement({ classes: ['tab-nav'] });
  const clipsTab = createFakeElement({ id: 'clipsTab', classes: ['tab-content', 'active'] });
  const notesTab = createFakeElement({ id: 'notesTab', classes: ['tab-content'] });
  const shellIcon = createFakeElement({ icon: 'user' });
  const headerIcon = createFakeElement({ icon: 'settings' });
  const navIcon = createFakeElement({ icon: 'clipboard' });
  const activeIcon = createFakeElement({ icon: 'heart' });
  const hiddenIcon = createFakeElement({ icon: 'notebook' });
  topBar.appendChild(shellIcon);
  header.appendChild(headerIcon);
  nav.appendChild(navIcon);
  clipsTab.appendChild(activeIcon);
  notesTab.appendChild(hiddenIcon);
  [topBar, header, nav, clipsTab, notesTab].forEach((element) => body.appendChild(element));

  const selectorRoots = new Map([
    ['#topBar', topBar],
    ['.header', header],
    ['.tab-nav', nav],
  ]);
  const byId = new Map([
    ['clipsTab', clipsTab],
    ['notesTab', notesTab],
  ]);
  const conversionPasses = [];
  const document = {
    body,
    querySelector: (selector) => selectorRoots.get(selector) || null,
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    getElementById: (id) => byId.get(id) || null,
    addEventListener() {},
  };
  const context = createClassicContext({
    Element: function Element() {},
    MutationObserver: class MutationObserver {
      observe() {}
    },
    document,
    performance: { now: () => 1 },
    queueMicrotask,
    setTimeout,
  });
  Object.setPrototypeOf(body, context.Element.prototype);
  [topBar, header, nav, clipsTab, notesTab, shellIcon, headerIcon, navIcon, activeIcon, hiddenIcon]
    .forEach((element) => Object.setPrototypeOf(element, context.Element.prototype));
  context.pasteCraftPopup = { currentTab: 'clips' };
  context.lucide = {
    createIcons() {
      const visible = document.querySelectorAll('[data-lucide]');
      conversionPasses.push(visible.map((element) => element.getAttribute('data-lucide')));
      visible.forEach((element) => { element.tagName = 'SVG'; });
    },
  };
  vm.runInNewContext(readExtensionFile('popup/shared/popup-icons.js'), context);

  context.finishBootLucideIcons();
  assert.deepEqual(
    new Set(conversionPasses[0]),
    new Set(['user', 'settings', 'clipboard', 'heart']),
  );
  assert.equal(hiddenIcon.getAttribute('data-lucide'), 'notebook');

  clipsTab.classList.remove('active');
  notesTab.classList.add('active');
  context.renderLucideIconsForActiveTab('notes', 'test', { immediate: true });
  assert.deepEqual(conversionPasses[1], ['notebook']);
  assert.equal(hiddenIcon.hasAttribute('data-lucide'), false);

  context.renderLucideIconsForActiveTab('notes', 'test', { immediate: true });
  assert.equal(conversionPasses.length, 2);
});
