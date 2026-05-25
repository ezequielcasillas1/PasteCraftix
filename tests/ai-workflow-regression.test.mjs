import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, before, describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const aiWorkflowPath = path.join(root, 'supabase/functions/_shared/ai_workflow.ts');

let aiWorkflow;
const originalFetch = globalThis.fetch;
const originalDeno = globalThis.Deno;

before(async () => {
  const source = fs
    .readFileSync(aiWorkflowPath, 'utf8')
    .replace(/^import[^\n]*\n/gm, '');
  const js = stripTypeScriptTypes(source, { mode: 'transform' });
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  aiWorkflow = await import(url);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.Deno = originalDeno;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ai_workflow regression coverage', () => {
  test('parses only enabled workflows and defaults unsafe provider presets', () => {
    assert.equal(aiWorkflow.parseAiWorkflowFromBody({}), null);
    assert.equal(
      aiWorkflow.parseAiWorkflowFromBody({ aiWorkflow: { enabled: false } }),
      null,
    );

    assert.deepEqual(
      aiWorkflow.parseAiWorkflowFromBody({
        aiWorkflow: { enabled: true, provider: 'google', preset: 'gpt5_mini' },
      }),
      { provider: 'google', preset: 'default' },
    );

    assert.deepEqual(
      aiWorkflow.parseAiWorkflowFromBody({
        aiWorkflow: { enabled: true, provider: 'anthropic', preset: 'latest' },
      }),
      { provider: 'openai', preset: 'latest' },
    );
  });

  test('resolves model choices and fallback chains for active providers', () => {
    assert.deepEqual(
      aiWorkflow.resolveModelsFromWorkflow({ provider: 'google', preset: 'latest' }),
      {
        provider: 'google',
        preset: 'latest',
        chatTextModel: 'gemini-2.5-flash-preview-04-17',
        chatVisionModel: 'gemini-2.5-flash-preview-04-17',
        imageGenerationModel: 'gpt-image-1',
        apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKeyEnv: 'GOOGLE_AI_KEY',
      },
    );

    assert.deepEqual(
      aiWorkflow.getChatModelFallbackChain('gpt-5.2'),
      ['gpt-5.2', 'gpt-5', 'gpt-4o-mini'],
    );
    assert.deepEqual(
      aiWorkflow.getChatModelFallbackChain('gemini-2.5-pro-preview-05-06', 'google'),
      ['gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash'],
    );
  });

  test('normalizes GPT-5 payloads without mutating legacy model payloads', () => {
    const gpt5Payload = {
      messages: [{ role: 'user', content: 'Summarize this.' }],
      max_tokens: 120,
      temperature: 0.2,
    };
    assert.deepEqual(
      aiWorkflow.normalizeChatCompletionPayload(gpt5Payload, 'gpt-5.2'),
      {
        messages: [{ role: 'user', content: 'Summarize this.' }],
        max_completion_tokens: 120,
      },
    );
    assert.equal(gpt5Payload.max_tokens, 120, 'input payload is not mutated');

    const legacyPayload = { max_tokens: 80, temperature: 0.2 };
    assert.deepEqual(
      aiWorkflow.normalizeChatCompletionPayload(legacyPayload, 'gpt-4o-mini'),
      legacyPayload,
    );
  });

  test('uses Claude fallback for non-vision text errors after provider failure', async () => {
    const calls = [];
    globalThis.Deno = {
      env: {
        get(key) {
          return key === 'ANTHROPIC_API_KEY' ? 'anthropic-test-key' : '';
        },
      },
    };
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      if (String(url).includes('anthropic.com')) {
        return jsonResponse({ content: [{ type: 'text', text: 'fallback ok' }] });
      }
      return jsonResponse({ error: { message: 'provider temporarily unavailable' } }, 503);
    };

    const result = await aiWorkflow.fetchChatCompletionsWithModelFallback(
      'openai-test-key',
      { messages: [{ role: 'user', content: 'hello' }], max_tokens: 16 },
      'gpt-4o',
    );

    assert.equal(result.usedModel, 'claude-3-5-haiku-latest');
    assert.deepEqual(result.data.choices[0].message, {
      role: 'assistant',
      content: 'fallback ok',
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.max_tokens, 256, 'Claude fallback clamps tiny max_tokens');
  });

  test('does not route vision payload failures to text-only Claude fallback', async () => {
    const calls = [];
    globalThis.Deno = {
      env: {
        get(key) {
          return key === 'ANTHROPIC_API_KEY' ? 'anthropic-test-key' : '';
        },
      },
    };
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      return jsonResponse({ error: { message: 'provider temporarily unavailable' } }, 503);
    };

    await assert.rejects(
      aiWorkflow.fetchChatCompletionsWithModelFallback(
        'openai-test-key',
        {
          messages: [{
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }],
          }],
        },
        'gpt-4o',
      ),
      /provider temporarily unavailable/,
    );

    assert.equal(calls.length, 1, 'vision failures stay with the configured provider');
    assert.ok(!calls.some((call) => call.url.includes('anthropic.com')));
  });
});
