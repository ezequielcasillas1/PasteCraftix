/**
 * Profile merge — local names must not be wiped by empty remote values.
 * Run: node --test tests/profile-merge.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  mergeUserProfileLocalRemote,
  preferProfileText,
} from '../extension/shared/profile-merge.js';

describe('profile merge', () => {
  test('preferProfileText keeps local when remote is empty', () => {
    assert.equal(preferProfileText('Ezequiel', ''), 'Ezequiel');
    assert.equal(preferProfileText('Ezequiel', null), 'Ezequiel');
  });

  test('preferProfileText uses remote when local is empty', () => {
    assert.equal(preferProfileText('', 'Cloud Name'), 'Cloud Name');
    assert.equal(preferProfileText('   ', 'Cloud Name'), 'Cloud Name');
  });

  test('preferProfileText trims whitespace', () => {
    assert.equal(preferProfileText('  Local  ', '  Remote  '), 'Local');
  });

  test('mergeUserProfileLocalRemote preserves local userName when remote is blank', () => {
    const merged = mergeUserProfileLocalRemote(
      { userName: 'Saved Name', aiGeneratedName: 'AI Name' },
      { userName: '', aiGeneratedName: null },
    );

    assert.equal(merged.userName, 'Saved Name');
    assert.equal(merged.aiGeneratedName, 'AI Name');
  });

  test('mergeUserProfileLocalRemote prefers remote profile image base64 when present', () => {
    const merged = mergeUserProfileLocalRemote(
      { profileImageBase64: 'local-data' },
      { profileImageBase64: 'remote-data' },
    );

    assert.equal(merged.profileImageBase64, 'remote-data');
  });

  test('mergeUserProfileLocalRemote keeps local base64 when remote missing', () => {
    const merged = mergeUserProfileLocalRemote(
      { profileImageBase64: 'local-data' },
      {},
    );

    assert.equal(merged.profileImageBase64, 'local-data');
  });

  test('mergeUserProfileLocalRemote uses custom pickUrl for profileImageUrl', () => {
    const merged = mergeUserProfileLocalRemote(
      { profileImageUrl: 'https://local.example/photo.jpg' },
      { profileImageUrl: 'https://remote.example/photo.jpg' },
      (localUrl, remoteUrl) => localUrl || remoteUrl,
    );

    assert.equal(merged.profileImageUrl, 'https://local.example/photo.jpg');
  });

  test('mergeUserProfileLocalRemote respects remote aiGeneratedImage boolean', () => {
    const merged = mergeUserProfileLocalRemote(
      { aiGeneratedImage: true },
      { aiGeneratedImage: false },
    );

    assert.equal(merged.aiGeneratedImage, false);
  });
});
