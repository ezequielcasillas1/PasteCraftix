import { createTestLabAdapter } from './adapter-base.js';

export const printifyAdapter = createTestLabAdapter({
  platformId: 'printify',
  bodyPlatform: 'printify',
  pathHint: '/printify.html',
  dispatchOrder: ['keywords', 'title', 'description'],
  fieldMap: {
    keywords: { selector: '[data-field^="printify-tag-"]', fallbackField: 'tags' },
    title: { selector: '[data-field="printify-title"]' },
    description: { selector: '[data-field="printify-seo-desc"]' },
  },
});
