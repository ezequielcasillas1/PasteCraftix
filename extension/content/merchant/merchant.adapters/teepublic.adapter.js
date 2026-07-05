import { createTestLabAdapter } from './adapter-base.js';

export const teepublicAdapter = createTestLabAdapter({
  platformId: 'teepublic',
  bodyPlatform: 'teepublic',
  pathHint: '/teepublic.html',
  dispatchOrder: ['tags', 'title'],
  fieldMap: {
    tags: { selector: '[data-field^="teepublic-tag-"]' },
    title: { selector: '[data-field="teepublic-title"]' },
  },
});
