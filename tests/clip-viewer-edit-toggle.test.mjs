import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const viewerPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension/popup/features/clips/clips.viewer.js');
const source = readFileSync(viewerPath, 'utf8');

const STAY = '#clipViewerBody, #saveClipViewerEditBtn, #cancelClipViewerEditBtn, #clipViewerStudyToolbar';

function wasClipViewerDragSelect(app) {
  const gesture = app?._clipViewerPointerGesture;
  return !!(gesture?.startedInBody && gesture.moved);
}

function shouldExitClipViewerEdit(app, target) {
  if (!app?._clipViewerEditing) return false;
  if (!target?.closest) return false;
  if (!target.closest('#clipViewerModal')) return false;
  if (target.closest(STAY)) return false;
  if (wasClipViewerDragSelect(app)) return false;
  return true;
}

test('viewer still exports drag/exit helpers', () => {
  assert.match(source, /export function wasClipViewerDragSelect/);
  assert.match(source, /export function shouldExitClipViewerEdit/);
});

test('click Keywords while editing returns to original view', () => {
  const keywords = {
    closest(sel) {
      if (sel === '#clipViewerModal') return {};
      if (sel === STAY) return null;
      return null;
    },
  };
  assert.equal(shouldExitClipViewerEdit({ _clipViewerEditing: true }, keywords), true);
});

test('click inside text box stays in edit', () => {
  const box = {
    closest(sel) {
      if (sel === '#clipViewerModal') return {};
      if (sel === STAY) return {};
      return null;
    },
  };
  assert.equal(shouldExitClipViewerEdit({ _clipViewerEditing: true }, box), false);
});

test('drag that started in the box does not exit', () => {
  const keywords = {
    closest(sel) {
      if (sel === '#clipViewerModal') return {};
      if (sel === STAY) return null;
      return null;
    },
  };
  assert.equal(
    shouldExitClipViewerEdit(
      { _clipViewerEditing: true, _clipViewerPointerGesture: { startedInBody: true, moved: true } },
      keywords,
    ),
    false,
  );
});

test('study toolbar click stays in edit', () => {
  const toolbar = {
    closest(sel) {
      if (sel === '#clipViewerModal') return {};
      if (sel === STAY) return {};
      return null;
    },
  };
  assert.equal(shouldExitClipViewerEdit({ _clipViewerEditing: true }, toolbar), false);
});

test('stay selector includes the study toolbar', () => {
  assert.match(
    source,
    /CLIP_VIEWER_EDIT_STAY_SELECTORS\s*=\s*'[^']*#clipViewerStudyToolbar[^']*'/,
  );
});

test('click that started outside the box exits even if the pointer moved', () => {
  const keywords = {
    closest(sel) {
      if (sel === '#clipViewerModal') return {};
      if (sel === STAY) return null;
      return null;
    },
  };
  assert.equal(
    shouldExitClipViewerEdit(
      { _clipViewerEditing: true, _clipViewerPointerGesture: { startedInBody: false, moved: true } },
      keywords,
    ),
    true,
  );
});
