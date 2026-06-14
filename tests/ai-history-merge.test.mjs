import assert from 'node:assert/strict';
import test from 'node:test';

import { aiHistorySyncMixin } from '../extension/supabase/ai-history-sync.js';

const mergeAiHistory = aiHistorySyncMixin.mergeAiHistory.bind({});

test('mergeAiHistory preserves local source text when newer remote row wins', () => {
  const localSource = 'Explain quantum entanglement in plain language.';
  const localHistory = [
    {
      id: 42,
      type: 'breakdown',
      title: 'Local breakdown',
      originalText: localSource,
      threads: [
        {
          question: 'Break this down',
          answer: 'Older answer',
          level: 'college',
          timestamp: 1000,
        },
      ],
      updatedAt: 1000,
    },
  ];
  const remoteHistory = [
    {
      id: 42,
      type: 'breakdown',
      title: 'Cloud breakdown',
      originalText: '',
      threads: [
        {
          question: 'Break this down',
          answer: 'Newer answer',
          level: 'college',
          timestamp: 2000,
        },
      ],
      updatedAt: 2000,
    },
  ];

  const [merged] = mergeAiHistory(localHistory, remoteHistory);

  assert.equal(merged.title, 'Cloud breakdown');
  assert.equal(merged.originalText, localSource);
  assert.equal(merged.threads[0].sourceText, localSource);
  assert.equal(merged.threads[0].answer, 'Newer answer');
});
