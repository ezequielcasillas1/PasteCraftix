import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, 'supabase/functions/_shared/ai_workflow.ts');

let modulePromise;

async function loadWorkflowModule() {
  if (!modulePromise) {
    const source = fs
      .readFileSync(workflowPath, 'utf8')
      .replace(/^import .*$/gm, '');
    const js = stripTypeScriptTypes(source, { mode: 'strip' });
    modulePromise = import(`data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`);
  }
  return modulePromise;
}

function createJsonResponse({ ok, statusText = '', body }) {
  return {
    ok,
    statusText,
    async json() {
      return body;
    },
  };
}

describe('AI workflow regression coverage', () => {
  test('normalizes enabled workflow input by provider-specific presets', async () => {
    const { parseAiWorkflowFromBody } = await loadWorkflowModule();

    assert.equal(parseAiWorkflowFromBody(null), null);
    assert.equal(parseAiWorkflowFromBody({ aiWorkflow: { enabled: false } }), null);
    assert.deepEqual(
      parseAiWorkflowFromBody({ aiWorkflow: { enabled: true, provider: 'google', preset: 'gemini_pro' } }),
      { provider: 'google', preset: 'gemini_pro' },
    );
    assert.deepEqual(
      parseAiWorkflowFromBody({ aiWorkflow: { enabled: true, provider: 'google', preset: 'gpt5_mini' } }),
      { provider: 'google', preset: 'default' },
    );
    assert.deepEqual(
      parseAiWorkflowFromBody({ aiWorkflow: { enabled: true, provider: 'unknown', preset: 'latest' } }),
      { provider: 'openai', preset: 'latest' },
    );
  });

  test('resolves provider model config and weighted credit costs', async () => {
    const { getTextCreditCost, resolveModelsFromWorkflow } = await loadWorkflowModule();

    assert.deepEqual(
      resolveModelsFromWorkflow({ provider: 'google', preset: 'latest' }),
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
    assert.equal(getTextCreditCost('openai', 'gpt5_mini'), 200);
    assert.equal(getTextCreditCost('google', 'gemini_pro'), 350);
    assert.equal(getTextCreditCost('google', 'gpt5_mini'), 40);
  });

  test('adapts GPT-5 chat payloads without mutating legacy models', async () => {
    const { normalizeChatCompletionPayload } = await loadWorkflowModule();
    const basePayload = { messages: [], max_tokens: 123, temperature: 0.2 };

    assert.deepEqual(
      normalizeChatCompletionPayload(basePayload, 'gpt-5-mini'),
      { messages: [], max_completion_tokens: 123 },
    );
    assert.deepEqual(
      normalizeChatCompletionPayload(basePayload, 'gpt-4o-mini'),
      basePayload,
    );
    assert.deepEqual(basePayload, { messages: [], max_tokens: 123, temperature: 0.2 });
  });

  test('tries missing-model fallback chain and keeps vision requests off Claude fallback', async () => {
    const { fetchChatCompletionsWithModelFallback } = await loadWorkflowModule();
    const priorFetch = globalThis.fetch;
    const priorDeno = globalThis.Deno;
    const calls = [];

    globalThis.Deno = { env: { get: () => 'anthropic-key' } };
    globalThis.fetch = async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return createJsonResponse({
        ok: false,
        body: { error: { message: 'The model does not exist' } },
      });
    };

    try {
      await assert.rejects(
        fetchChatCompletionsWithModelFallback(
          'openai-key',
          { messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }] }], max_tokens: 16 },
          'gpt-5.2',
          { provider: 'openai', apiBaseUrl: 'https://api.openai.com/v1' },
        ),
        /model does not exist/,
      );

      assert.deepEqual(calls.map((body) => body.model), ['gpt-5.2', 'gpt-5', 'gpt-4o-mini']);
      assert.equal(calls[0].max_completion_tokens, 16);
      assert.equal('max_tokens' in calls[0], false);
      assert.equal(calls[2].max_tokens, 16);
    } finally {
      globalThis.fetch = priorFetch;
      globalThis.Deno = priorDeno;
    }
  });

  test('uses Claude fallback for non-vision provider errors', async () => {
    const { fetchChatCompletionsWithModelFallback } = await loadWorkflowModule();
    const priorFetch = globalThis.fetch;
    const priorDeno = globalThis.Deno;
    const calls = [];

    globalThis.Deno = {
      env: {
        get(name) {
          return name === 'ANTHROPIC_API_KEY' ? 'anthropic-key' : '';
        },
      },
    };
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (String(url).includes('anthropic.com')) {
        return createJsonResponse({
          ok: true,
          body: { content: [{ type: 'text', text: 'fallback ok' }] },
        });
      }
      return createJsonResponse({
        ok: false,
        statusText: 'rate limited',
        body: { error: { message: 'rate limited' } },
      });
    };

    try {
      const result = await fetchChatCompletionsWithModelFallback(
        'openai-key',
        {
          messages: [
            { role: 'system', content: 'Be concise.' },
            { role: 'user', content: 'Hello' },
          ],
          max_tokens: 32,
        },
        'gpt-4o',
        { provider: 'openai', apiBaseUrl: 'https://api.openai.com/v1' },
      );

      assert.equal(result.usedModel, 'claude-3-5-haiku-latest');
      assert.equal(result.data.choices[0].message.content, 'fallback ok');
      assert.equal(calls.length, 2);
      assert.equal(calls[1].body.system, 'Be concise.');
      assert.deepEqual(calls[1].body.messages, [{ role: 'user', content: 'Hello' }]);
    } finally {
      globalThis.fetch = priorFetch;
      globalThis.Deno = priorDeno;
    }
  });
});
