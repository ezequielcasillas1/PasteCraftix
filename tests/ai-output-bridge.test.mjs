import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  artifactToNotesClip,
  clearAiTaskOutputArtifact,
  consumeAiTaskOutputArtifact,
  getAiTaskOutputArtifact,
  normalizeAiTaskOutputArtifact,
  setAiTaskOutputArtifact,
} from '../extension/popup/shared/ai-output-bridge.js';

describe('AI output bridge', () => {
  test('normalizes artifact input and filters unsafe metadata shapes', () => {
    const artifact = normalizeAiTaskOutputArtifact({
      source: ' Popup\r\n ',
      taskType: 'UNSUPPORTED',
      outputText: '\r\n  Result text  ',
      sourceText: ` ${'s'.repeat(5000)} `,
      metadata: {
        ok: true,
        score: 3,
        tags: ['a', { nested: true }, null, 'b'],
        nested: { blocked: true },
        emptyArray: [],
      },
      createdAt: 1710000000000,
    });

    assert.equal(artifact.source, 'Popup');
    assert.equal(artifact.taskType, 'general');
    assert.equal(artifact.title, 'AI AI Output');
    assert.equal(artifact.outputText, 'Result text');
    assert.equal(artifact.sourceText.length, 4000);
    assert.deepEqual(artifact.metadata, {
      ok: true,
      score: 3,
      tags: ['a', null, 'b'],
      emptyArray: [],
    });
  });

  test('rejects empty output and keeps app handoff state explicit', () => {
    const app = {};

    assert.equal(setAiTaskOutputArtifact(app, { outputText: '   ' }), null);
    assert.equal(getAiTaskOutputArtifact(app), null);

    const artifact = setAiTaskOutputArtifact(app, {
      source: 'summary-panel',
      taskType: 'summary',
      outputText: 'Useful summary',
      createdAt: 1710000000000,
    });

    assert.equal(getAiTaskOutputArtifact(app), artifact);
    assert.equal(consumeAiTaskOutputArtifact(app), artifact);
    assert.equal(getAiTaskOutputArtifact(app), null);

    setAiTaskOutputArtifact(app, {
      source: 'summary-panel',
      taskType: 'summary',
      outputText: 'Another summary',
      createdAt: 1710000000001,
    });
    clearAiTaskOutputArtifact(app);
    assert.equal(getAiTaskOutputArtifact(app), null);
  });

  test('hashes duplicate AI outputs consistently while question changes create new attachments', () => {
    const base = {
      source: 'summary-panel',
      taskType: 'summary',
      outputText: 'Same answer',
      metadata: { runId: 'ignored-for-hash' },
      createdAt: 1710000000000,
    };

    const first = normalizeAiTaskOutputArtifact(base);
    const duplicate = normalizeAiTaskOutputArtifact({
      ...base,
      title: 'Different display title',
      metadata: { runId: 'different' },
    });
    const differentQuestion = normalizeAiTaskOutputArtifact({
      ...base,
      question: 'What changed?',
    });

    assert.equal(first.artifactHash, duplicate.artifactHash);
    assert.notEqual(first.artifactHash, differentQuestion.artifactHash);
  });

  test('converts normalized artifact to a deterministic Notes clip attachment', () => {
    const previousNow = Date.now;
    Date.now = () => 1710000012345;

    try {
      const artifact = normalizeAiTaskOutputArtifact({
        source: 'breakdown-panel',
        taskType: 'breakdown',
        title: 'Risk Breakdown',
        outputText: '1. Validate inputs\n2. Save safely',
        level: 'detailed',
        createdAt: 1710000000000,
      });
      const clip = artifactToNotesClip(artifact);

      assert.equal(clip.id, `ai-artifact-${artifact.artifactHash}`);
      assert.equal(clip.title, 'Risk Breakdown');
      assert.equal(clip.category, 'Uncategorized');
      assert.equal(clip.timestamp, 1710000012345);
      assert.equal(clip.updatedAt, 1710000012345);
      assert.equal(clip.__aiArtifactId, artifact.artifactId);
      assert.equal(clip.__aiArtifactHash, artifact.artifactHash);
      assert.equal(clip.meta.aiTaskOutput, true);
      assert.equal(clip.meta.aiTaskType, 'breakdown');
      assert.match(clip.text, /^\[AI Breakdown\]\nTitle: Risk Breakdown\nLevel: detailed\nSource: breakdown-panel\nArtifact: /);
      assert.match(clip.text, /\n\n1\. Validate inputs\n2\. Save safely$/);
    } finally {
      Date.now = previousNow;
    }
  });
});
