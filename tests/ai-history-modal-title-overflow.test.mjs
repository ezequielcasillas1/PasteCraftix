import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('history modal header constrains long titles so the close corner stays visible', () => {
  const html = read('extension/popup.html');
  const lucide = read('extension/AiLucideStyles.css');

  assert.match(
    html,
    /#aiHistoryModal \.breakdown-header-content[\s\S]*?flex:\s*1[\s\S]*?min-width:\s*0/,
    'header content must shrink inside the flex header',
  );
  assert.match(
    html,
    /#aiHistoryModal \.breakdown-header-actions[\s\S]*?flex-shrink:\s*0/,
    'close button column must not be pushed off-canvas',
  );
  assert.match(
    html,
    /#aiHistoryModal \.breakdown-modal-content[\s\S]*?min-width:\s*0/,
    'modal card must not grow past the popup from nowrap title min-content',
  );
  assert.match(
    lucide,
    /\.ai-history-modal-title-display\s*\{[^}]*white-space:\s*normal/s,
    'history title must wrap instead of nowrap-clipping the latest long title',
  );
  assert.equal(
    /white-space:\s*nowrap/.test(lucide.match(/\.ai-history-modal-title-display\s*\{[^}]+\}/)?.[0] || ''),
    false,
    'nowrap on the history title reintroduces the clipped latest-entry header',
  );
});
