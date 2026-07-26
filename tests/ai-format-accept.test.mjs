import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const formatUrl = pathToFileURL(
  path.join(root, 'extension/popup/features/ai-lab/ai-lab.magic.craft.format.js'),
).href;

const { _isSuspiciousAiFormatOutput, _populateAiFormatMap } = await import(formatUrl);

test('accepts normal grammar polish that grows past +12%', () => {
  const original =
    'hey so just wanted to touch base about the meeting yesterday we talked about the launch timeline i think we should push the release to next friday instead of wednesday also can someone confirm if the stripe webhook is still failing on edge and who is owning that fix thanks';
  const formatted =
    'Hey, so I just wanted to touch base about the meeting yesterday. We talked about the launch timeline. I think we should push the release to next Friday instead of Wednesday. Also, can someone confirm if the Stripe webhook is still failing on Edge and who is owning that fix? Thanks.';

  assert.equal(_isSuspiciousAiFormatOutput(original, formatted), false);

  const map = new Map();
  _populateAiFormatMap(map, [{ id: '1', text: original }], [formatted]);
  assert.equal(map.get('1'), formatted);
});

test('rejects heavy AI filler fluff', () => {
  const original = 'Need to fix the sync bug.';
  const formatted =
    "It's important to note that we need to delve into fixing the sync bug in today's world.";
  assert.equal(_isSuspiciousAiFormatOutput(original, formatted), true);
});

test('rejects identical text', () => {
  const map = new Map();
  _populateAiFormatMap(map, [{ id: '1', text: 'Same text' }], ['Same text']);
  assert.equal(map.size, 0);
});
