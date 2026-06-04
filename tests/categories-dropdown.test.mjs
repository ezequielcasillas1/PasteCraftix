/**
 * Regression tests for category dropdown source-of-truth.
 * Run: node --test tests/categories-dropdown.test.mjs
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  populatePdfCategoryDropdown,
  updateManualInputCategories,
} from '../extension/popup/features/categories/categories.render.js';

const priorDocument = globalThis.document;

function createOptionElement() {
  return {
    value: '',
    textContent: '',
  };
}

function createSelectElement(initialValue = '') {
  return {
    children: [],
    value: initialValue,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    set innerHTML(_value) {
      this.children = [];
    },
    get innerHTML() {
      return this.children.map((child) => child.textContent).join('');
    },
  };
}

function installDocumentHarness(elementsById) {
  globalThis.document = {
    getElementById(id) {
      return elementsById[id] || null;
    },
    createElement(tagName) {
      assert.equal(tagName, 'option');
      return createOptionElement();
    },
  };
}

function optionValues(select) {
  return select.children.map((child) => child.value);
}

beforeEach(() => {
  installDocumentHarness({});
});

afterEach(() => {
  globalThis.document = priorDocument;
});

describe('category dropdowns', () => {
  test('manual input uses active CRUD categories, not stale clip categories', () => {
    const manualInputCategory = createSelectElement('Recipes');
    installDocumentHarness({ manualInputCategory });

    updateManualInputCategories({
      clips: [{ category: 'Clip Only' }],
      searchOnlyClips: [{ category: 'Search Only' }],
      categories: [
        { name: 'Recipes', updatedAt: 20 },
        { name: 'Deleted Category', updatedAt: 30, deletedAt: Date.now() },
        { name: 'Work', updatedAt: 40 },
      ],
    });

    assert.deepEqual(optionValues(manualInputCategory), [
      'Uncategorized',
      'Work',
      'Recipes',
    ]);
    assert.equal(manualInputCategory.value, 'Recipes');
  });

  test('manual input falls back when the selected category is deleted', () => {
    const manualInputCategory = createSelectElement('Deleted Category');
    installDocumentHarness({ manualInputCategory });

    updateManualInputCategories({
      categories: [
        { name: 'Deleted Category', updatedAt: 30, deletedAt: Date.now() },
        { name: 'Work', updatedAt: 40 },
      ],
    });

    assert.deepEqual(optionValues(manualInputCategory), ['Uncategorized', 'Work']);
    assert.equal(manualInputCategory.value, 'Uncategorized');
  });

  test('pdf category dropdown follows the same active newest-first list', () => {
    const pdfExtractCategory = createSelectElement('Ignored');
    installDocumentHarness({ pdfExtractCategory });

    populatePdfCategoryDropdown({
      clips: [{ category: 'Legacy Clip Category' }],
      categories: [
        { name: 'Old', createdAt: 10 },
        { name: 'New', createdAt: 50 },
        { name: 'Removed', createdAt: 80, deletedAt: Date.now() },
      ],
    });

    assert.deepEqual(optionValues(pdfExtractCategory), [
      'Uncategorized',
      'New',
      'Old',
    ]);
    assert.equal(pdfExtractCategory.value, 'Uncategorized');
  });
});
