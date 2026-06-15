import assert from 'node:assert/strict';
import test from 'node:test';

import { refreshPopupAfterBackgroundSync } from '../extension/popup/features/sync/sync.listener.js';

test('refreshPopupAfterBackgroundSync reloads clips, categories, and profile', async () => {
  const calls = [];
  const app = {
    userProfile: { profileImageUrl: 'data:image/png;base64,abc' },
    async loadData() {
      calls.push('loadData');
    },
    renderChips() {
      calls.push('renderChips');
    },
    renderCategories() {
      calls.push('renderCategories');
    },
    updateCategoryFilter() {
      calls.push('updateCategoryFilter');
    },
    updateManualInputCategories() {
      calls.push('updateManualInputCategories');
    },
    async loadUserProfile() {
      calls.push('loadUserProfile');
    },
    updateTopBarIdentity(url) {
      calls.push(['updateTopBarIdentity', url]);
    },
  };

  await refreshPopupAfterBackgroundSync(app);

  assert.deepEqual(calls, [
    'loadData',
    'renderChips',
    'renderCategories',
    'updateCategoryFilter',
    'updateManualInputCategories',
    'loadUserProfile',
    ['updateTopBarIdentity', 'data:image/png;base64,abc'],
  ]);
});
