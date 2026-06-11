/**
 * Run: node --test tests/ai-output-bridge.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  artifactToNotesClip,
  consumeAiTaskOutputArtifact,
  normalizeAiTaskOutputArtifact,
  setAiTaskOutputArtifact,
} from '../extension/popup/shared/ai-output-bridge.js';

test('normalizeAiTaskOutputArtifact rejects empty output', () => {
  assert.equal(normalizeAiTaskOutputArtifact({ outputText: '   ' }), null);
});

test('normalizeAiTaskOutputArtifact normalizes risky fields deterministically', () => {
  const artifact = normalizeAiTaskOutputArtifact({
    source: 'SummaryPanel',
    taskType: 'unknown-task',
    title: '',
    outputText: '  first line\r\nsecond line\rthird line  ',
    sourceText: 'source',
    question: 'What changed?',
    level: 'deep',
    metadata: {
      creditsUsed: 2,
      fromCache: false,
      tags: ['a', 1, true, { nested: true }],
      nested: { unsafe: true },
    },
    createdAt: 1710000000000,
  });

  assert.equal(artifact.taskType, 'general');
  assert.equal(artifact.outputText, 'first line\nsecond line\nthird line');
  assert.equal(artifact.title, 'AI AI Output');
  assert.deepEqual(artifact.metadata, {
    creditsUsed: 2,
    fromCache: false,
    tags: ['a', 1, true],
  });
  assert.match(artifact.artifactId, /^ai-summarypanel-general-1710000000000$/);
  assert.match(artifact.artifactHash, /^[a-f0-9]{8}$/);
});

test('set and consume AI artifact clears pending app state', () => {
  const app = {};
  const artifact = setAiTaskOutputArtifact(app, {
    source: 'history',
    taskType: 'history',
    outputText: 'Saved answer',
    createdAt: 1710000000000,
  });

  assert.equal(app.pendingAiTaskOutputArtifact, artifact);
  assert.equal(consumeAiTaskOutputArtifact(app), artifact);
  assert.equal(app.pendingAiTaskOutputArtifact, null);
});

test('artifactToNotesClip adds AI metadata and deterministic attachment id', () => {
  const originalNow = Date.now;
  Date.now = () => 1710000001234;
  try {
    const artifact = normalizeAiTaskOutputArtifact({
      artifactId: 'artifact-1',
      source: 'summary',
      taskType: 'summary',
      title: 'Release notes',
      question: 'Summarize',
      level: 'short',
      outputText: 'Ship safely.',
      createdAt: 1710000000000,
    });
    const clip = artifactToNotesClip(artifact);

    assert.equal(clip.id, `ai-artifact-${artifact.artifactHash}`);
    assert.equal(clip.title, 'Release notes');
    assert.equal(clip.timestamp, 1710000001234);
    assert.equal(clip.updatedAt, 1710000001234);
    assert.match(clip.text, /^\[AI Summary\]\nTitle: Release notes\nQuestion: Summarize\nLevel: short\nSource: summary\nArtifact: artifact-1\nCreated: /);
    assert.ok(clip.text.endsWith('\n\nShip safely.'));
    assert.deepEqual(clip.meta, {
      aiTaskOutput: true,
      aiTaskType: 'summary',
      aiSource: 'summary',
      aiArtifactId: 'artifact-1',
      aiArtifactHash: artifact.artifactHash,
      aiCreatedAt: 1710000000000,
    });
  } finally {
    Date.now = originalNow;
  }
});
