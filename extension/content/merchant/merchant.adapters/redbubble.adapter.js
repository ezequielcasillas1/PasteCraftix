import { createTestLabAdapter } from './adapter-base.js';

export const redbubbleAdapter = createTestLabAdapter({
  platformId: 'redbubble',
  bodyPlatform: 'redbubble',
  pathHint: '/redbubble.html',
  dispatchOrder: ['tags', 'title'],
  fieldMap: {
    tags: { selector: '[data-field^="redbubble-tag-"]' },
    title: { selector: '[data-field="redbubble-title"]' },
  },
});
