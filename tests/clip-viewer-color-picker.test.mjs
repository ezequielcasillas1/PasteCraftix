import assert from 'node:assert/strict';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(
  join(__dirname, '..', 'extension/popup/features/clips/clips.viewer-color-picker.js'),
).href;
const { hexToHsv, hsvToHex } = await import(url);

test('hsvToHex round-trips common highlight yellow', () => {
  const hsv = hexToHsv('#fde047');
  const back = hsvToHex(hsv.h, hsv.s, hsv.v);
  assert.match(back, /^#[0-9a-f]{6}$/);
  const again = hexToHsv(back);
  assert.ok(Math.abs(again.h - hsv.h) < 2);
  assert.ok(Math.abs(again.s - hsv.s) < 2);
  assert.ok(Math.abs(again.v - hsv.v) < 2);
});

test('hsvToHex pure red / green / blue corners', () => {
  assert.equal(hsvToHex(0, 100, 100), '#ff0000');
  assert.equal(hsvToHex(120, 100, 100), '#00ff00');
  assert.equal(hsvToHex(240, 100, 100), '#0000ff');
  assert.equal(hsvToHex(0, 0, 0), '#000000');
  assert.equal(hsvToHex(0, 0, 100), '#ffffff');
});

test('hexToHsv clamps invalid input to a usable default', () => {
  const hsv = hexToHsv('not-a-color');
  assert.equal(typeof hsv.h, 'number');
  assert.equal(typeof hsv.s, 'number');
  assert.equal(typeof hsv.v, 'number');
});
