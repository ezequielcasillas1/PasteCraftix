/**
 * Run: node --test tests/profile-merge.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeUserProfileLocalRemote,
  preferProfileText,
} from '../extension/shared/profile-merge.js';

test('preferProfileText keeps local name when remote is empty', () => {
  assert.equal(preferProfileText('Ezequiel', ''), 'Ezequiel');
  assert.equal(preferProfileText('Ezequiel', null), 'Ezequiel');
  assert.equal(preferProfileText('  Local  ', '  Remote  '), 'Local');
});

test('preferProfileText falls back to remote when local is blank', () => {
  assert.equal(preferProfileText('', 'Cloud Name'), 'Cloud Name');
  assert.equal(preferProfileText('   ', 'Cloud Name'), 'Cloud Name');
});

test('preferProfileText returns empty when both sides are blank', () => {
  assert.equal(preferProfileText('', ''), '');
  assert.equal(preferProfileText(null, undefined), '');
});

test('mergeUserProfileLocalRemote preserves local names against cloud nulls', () => {
  const merged = mergeUserProfileLocalRemote(
    { userName: 'Saved Name', aiGeneratedName: 'Funky Name' },
    { userName: null, aiGeneratedName: '' },
  );

  assert.equal(merged.userName, 'Saved Name');
  assert.equal(merged.aiGeneratedName, 'Funky Name');
});

test('mergeUserProfileLocalRemote uses pickUrl for profile image', () => {
  const pickUrl = (localUrl, remoteUrl) => localUrl || remoteUrl;
  const merged = mergeUserProfileLocalRemote(
    { profileImageUrl: 'https://local.test/avatar.png' },
    { profileImageUrl: 'https://remote.test/avatar.png' },
    pickUrl,
  );

  assert.equal(merged.profileImageUrl, 'https://local.test/avatar.png');
});

test('mergeUserProfileLocalRemote prefers remote base64 when present', () => {
  const merged = mergeUserProfileLocalRemote(
    { profileImageBase64: 'local-b64' },
    { profileImageBase64: 'remote-b64' },
  );

  assert.equal(merged.profileImageBase64, 'remote-b64');
});

test('mergeUserProfileLocalRemote keeps local base64 when remote missing', () => {
  const merged = mergeUserProfileLocalRemote(
    { profileImageBase64: 'local-b64' },
    {},
  );

  assert.equal(merged.profileImageBase64, 'local-b64');
});

test('mergeUserProfileLocalRemote uses remote aiGeneratedImage boolean when provided', () => {
  const merged = mergeUserProfileLocalRemote(
    { aiGeneratedImage: true },
    { aiGeneratedImage: false },
  );

  assert.equal(merged.aiGeneratedImage, false);
});
