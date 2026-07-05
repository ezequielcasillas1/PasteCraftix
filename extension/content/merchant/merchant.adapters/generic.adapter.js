import { createTestLabAdapter } from './adapter-base.js';

export const genericAdapter = createTestLabAdapter({
  platformId: 'generic',
  bodyPlatform: 'generic',
  pathHint: '/generic.html',
  dispatchOrder: ['tags'],
  fieldMap: {
    tags: { selector: '[data-field^="generic-field-"]', fallbackField: 'keywords' },
  },
});
