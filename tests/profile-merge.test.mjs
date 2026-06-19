/**
 * Run: node --test tests/profile-merge.test.mjs
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  preferProfileText,
  mergeUserProfileLocalRemote,
} from '../extension/shared/profile-merge.js';

describe('profile merge', () => {
  test('preferProfileText keeps local name when remote is empty', () => {
    assert.equal(preferProfileText('Alice', ''), 'Alice');
    assert.equal(preferProfileText('Alice', '   '), 'Alice');
  });

  test('preferProfileText uses remote when local is empty', () => {
    assert.equal(preferProfileText('', 'Bob'), 'Bob');
    assert.equal(preferProfileText(null, 'Bob'), 'Bob');
  });

  test('preferProfileText prefers local over remote when both set', () => {
    assert.equal(preferProfileText('Local Name', 'Cloud Name'), 'Local Name');
  });

  test('mergeUserProfileLocalRemote preserves local names against cloud nulls', () => {
    const local = { userName: 'Saved Name', aiGeneratedName: 'Funky Fox' };
    const remote = { userName: null, aiGeneratedName: '' };
    const merged = mergeUserProfileLocalRemote(local, remote);
    assert.equal(merged.userName, 'Saved Name');
    assert.equal(merged.aiGeneratedName, 'Funky Fox');
  });

  test('mergeUserProfileLocalRemote fills missing local names from remote', () => {
    const local = { userName: '' };
    const remote = { userName: 'From Cloud' };
    const merged = mergeUserProfileLocalRemote(local, remote);
    assert.equal(merged.userName, 'From Cloud');
  });

  test('mergeUserProfileLocalRemote uses pickUrl for profileImageUrl', () => {
    const pickUrl = (localUrl, remoteUrl) => localUrl || remoteUrl;
    const merged = mergeUserProfileLocalRemote(
      { profileImageUrl: 'https://local/img.png' },
      { profileImageUrl: 'https://remote/img.png' },
      pickUrl,
    );
    assert.equal(merged.profileImageUrl, 'https://local/img.png');
  });

  test('mergeUserProfileLocalRemote prefers remote profileImageBase64 when present', () => {
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

  test('mergeUserProfileLocalRemote uses remote aiGeneratedImage boolean when defined', () => {
    const merged = mergeUserProfileLocalRemote(
      { aiGeneratedImage: true },
      { aiGeneratedImage: false },
    );
    assert.equal(merged.aiGeneratedImage, false);
  });

  test('mergeUserProfileLocalRemote handles null inputs', () => {
    const merged = mergeUserProfileLocalRemote(null, { userName: 'Only Remote' });
    assert.equal(merged.userName, 'Only Remote');
  });
});
