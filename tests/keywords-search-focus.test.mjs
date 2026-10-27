import test from 'node:test';
import assert from 'node:assert/strict';

import { KEYWORD_SELECTORS } from '../extension/popup/features/keywords/keywords.constants.js';
import { ensureKeywordLibrary } from '../extension/popup/features/keywords/keywords.library.js';
import { renderKeywordLibrary } from '../extension/popup/features/keywords/keywords.library.render.js';
import { createKeywordsPageState } from '../extension/popup/features/keywords/keywords.state.js';

/**
 * Tiny DOM stand-in: writing innerHTML replaces the element's inputs with new nodes, so focus
 * on an old input is lost exactly as in a browser. Only what the Keywords render touches.
 */
function installFakeDom() {
  const body = { dataset: {} };
  const doc = { activeElement: body, elements: new Map() };
  class FakeInput {
    constructor(owner, field, value) {
      Object.assign(this, { owner, dataset: { field }, value, selectionStart: value.length, selectionEnd: value.length });
    }
    focus() { doc.activeElement = this; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  }
  class FakeElement {
    constructor(id) { Object.assign(this, { id, hidden: false, html: '', inputs: [], dataset: {} }); }
    set innerHTML(html) {
      if (this.inputs.includes(doc.activeElement)) doc.activeElement = body;
      this.html = String(html);
      this.inputs = [...this.html.matchAll(/<input\b[^>]*>/g)].map(([tag]) => new FakeInput(
        this,
        tag.match(/data-field="([^"]*)"/)?.[1] || '',
        (tag.match(/value="([^"]*)"/)?.[1] || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&'),
      ));
    }
    get innerHTML() { return this.html; }
    setAttribute() {}
    querySelector(sel) { return this.inputs.find((i) => sel.includes(`"${i.dataset.field}"`)) || null; }
  }
  [KEYWORD_SELECTORS.NAV, KEYWORD_SELECTORS.FILES, KEYWORD_SELECTORS.FOLDERS, KEYWORD_SELECTORS.LEARN, KEYWORD_SELECTORS.GAMES]
    .forEach((id) => doc.elements.set(id, new FakeElement(id)));
  doc.getElementById = (id) => doc.elements.get(id) || null;
  doc.querySelector = (sel) => {
    for (const el of doc.elements.values()) { const hit = el.querySelector(sel); if (hit) return hit; }
    return null;
  };
  const prev = globalThis.document;
  globalThis.document = doc;
  return { doc, restore: () => { globalThis.document = prev; } };
}

const app = { escapeHtml: (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') };
const QUERY_KEY = { words: 'wordSearch', learn: 'learnQuery', games: 'gamesQuery' };

for (const section of ['words', 'learn', 'games']) {
  test(`typing 'chess' key by key keeps focus and the full value (${section})`, () => {
    const { doc, restore } = installFakeDom();
    try {
      const { library, bank } = ensureKeywordLibrary(null, []);
      const page = createKeywordsPageState();
      page.section = section;
      const draw = () => renderKeywordLibrary(app, { library, bank, page });
      draw();
      doc.querySelector('[data-field="keyword-scoped-search"]').focus();
      let typed = '';
      for (const ch of 'chess') {
        const input = doc.activeElement;
        assert.equal(input?.dataset?.field, 'keyword-scoped-search', `focus lost before typing "${ch}"`);
        typed += ch;
        input.value = typed;
        input.selectionStart = input.selectionEnd = typed.length;
        page[QUERY_KEY[section]] = typed; // what the input handler stores before re-rendering
        draw();
      }
      assert.equal(doc.activeElement?.dataset?.field, 'keyword-scoped-search');
      assert.equal(doc.activeElement.value, 'chess');
      assert.equal(doc.activeElement.selectionStart, 5);
    } finally {
      restore();
    }
  });
}
