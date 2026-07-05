import { createTestLabAdapter } from './adapter-base.js';

export const etsyAdapter = createTestLabAdapter({
  platformId: 'etsy',
  bodyPlatform: 'etsy',
  pathHint: '/etsy.html',
  dispatchOrder: ['tags', 'materials', 'title', 'description'],
  fieldMap: {
    tags: { selector: '[data-field^="etsy-tag-"]' },
    materials: { selector: '[data-field^="etsy-material-"]' },
    title: { selector: '[data-field="listing-title"]' },
    description: { selector: '[data-field="listing-description"]' },
  },
});
