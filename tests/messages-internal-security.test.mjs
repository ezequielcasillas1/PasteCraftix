import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'extension/background/handlers/messages-internal.js'),
  'utf8'
);

function getActionBlock(action) {
  const marker = `if (message.action === '${action}')`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `action block not found: ${action}`);

  const next = source.indexOf('\n  if (message.action ===', start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('internal background message security guards', () => {
  test('rejects messages not sent by this extension runtime', () => {
    const listenerStart = source.indexOf('chrome.runtime.onMessage.addListener');
    const firstAction = source.indexOf("if (message.action === 'pcCopyText')");
    const prelude = source.slice(listenerStart, firstAction);

    assert.match(prelude, /sender\.id\s*!==\s*chrome\.runtime\.id/);
    assert.match(prelude, /error:\s*['"]invalid_sender['"]/);
    assert.match(prelude, /return false/);
  });

  test('derives extension-page context from chrome.runtime.getURL', () => {
    assert.match(source, /const isExtensionPage/);
    assert.match(source, /sender\.url\s*\|\|\s*sender\.tab\?\.url/);
    assert.match(source, /url\.startsWith\(chrome\.runtime\.getURL\(['"]{2}\)\)/);
  });

  test('blocks token refresh and checkout from content-page contexts', () => {
    for (const action of ['pcRefreshSupabaseToken', 'pcCreateCheckout']) {
      const block = getActionBlock(action);
      assert.match(block, /if \(!isExtensionPage\)/, `${action} must require extension page context`);
      assert.match(block, /error:\s*['"]forbidden_context['"]/, `${action} must return forbidden_context`);
      assert.match(block, /return false/, `${action} must stop before network work`);
    }
  });

  test('keeps refresh token endpoint scoped to Supabase projects', () => {
    const block = getActionBlock('pcRefreshSupabaseToken');
    assert.match(block, /\^https:\\\/\\\/\.\+\\\.supabase\\\.co\$/);
    assert.match(block, /error:\s*['"]Invalid supabaseUrl['"]/);
  });
});
