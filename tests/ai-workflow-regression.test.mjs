import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, 'supabase/functions/_shared/ai_workflow.ts');

let moduleNonce = 0;

function jsonResponse(ok, body, statusText = ok ? 'OK' : 'Error') {
  return {
    ok,
    statusText,
    async json() {
      return body;
    },
  };
}

async function withWorkflowModule({ env = {}, fetchImpl } = {}, run) {
  const priorDeno = globalThis.Deno;
  const priorFetch = globalThis.fetch;
  const priorCreateClient = globalThis.__pcCreateClient;
  const priorRequireNotBanned = globalThis.__pcRequireNotBanned;

  globalThis.Deno = {
    env: {
      get(name) {
        return env[name] || '';
      },
    },
  };
  globalThis.fetch = fetchImpl || (async () => jsonResponse(false, { error: 'unexpected fetch' }));
  globalThis.__pcCreateClient = () => {
    throw new Error('createClient was not expected in this test');
  };
  globalThis.__pcRequireNotBanned = async () => null;

  try {
    let source = fs.readFileSync(workflowPath, 'utf8');
    source = source
      .replace(
        "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'",
        'const createClient = globalThis.__pcCreateClient;'
      )
      .replace(
        "import { requireNotBanned } from './security-gate.ts'",
        'const requireNotBanned = globalThis.__pcRequireNotBanned;'
      );

    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}#${moduleNonce++}`;
    const mod = await import(url);
    return await run(mod);
  } finally {
    globalThis.Deno = priorDeno;
    globalThis.fetch = priorFetch;
    globalThis.__pcCreateClient = priorCreateClient;
    globalThis.__pcRequireNotBanned = priorRequireNotBanned;
  }
}

test('AI workflow body parsing and model resolution stay bounded to allowed providers', async () => {
  await withWorkflowModule({}, async (workflow) => {
    assert.deepEqual(
      workflow.parseAiWorkflowFromBody({
        aiWorkflow: { enabled: true, provider: 'google', preset: 'gemini_pro' },
      }),
      { provider: 'google', preset: 'gemini_pro' }
    );

    assert.equal(
      workflow.parseAiWorkflowFromBody({
        aiWorkflow: { enabled: false, provider: 'google', preset: 'latest' },
      }),
      null
    );

    assert.deepEqual(
      workflow.parseAiWorkflowFromBody({
        aiWorkflow: { enabled: true, provider: 'anthropic', preset: 'gemini_pro' },
      }),
      { provider: 'openai', preset: 'default' }
    );

    assert.deepEqual(
      workflow.resolveModelsFromWorkflow({ provider: 'google', preset: 'latest' }),
      {
        provider: 'google',
        preset: 'latest',
        chatTextModel: 'gemini-2.5-flash-preview-04-17',
        chatVisionModel: 'gemini-2.5-flash-preview-04-17',
        imageGenerationModel: 'gpt-image-1',
        apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKeyEnv: 'GOOGLE_AI_KEY',
      }
    );

    assert.equal(workflow.getTextCreditCost('google', 'latest'), 100);
    assert.equal(workflow.getTextCreditCost('openai', 'gpt5_mini'), 200);
  });
});

test('GPT-5 chat payloads use max_completion_tokens and safe fallback chains', async () => {
  await withWorkflowModule({}, async (workflow) => {
    const normalized = workflow.normalizeChatCompletionPayload(
      { max_tokens: 32, temperature: 0.2, messages: [] },
      'gpt-5-nano'
    );

    assert.equal(normalized.max_completion_tokens, 32);
    assert.equal('max_tokens' in normalized, false);
    assert.equal('temperature' in normalized, false);

    const legacy = workflow.normalizeChatCompletionPayload(
      { max_tokens: 32, temperature: 0.2, messages: [] },
      'gpt-4o-mini'
    );

    assert.equal(legacy.max_tokens, 32);
    assert.equal(legacy.temperature, 0.2);

    assert.deepEqual(
      workflow.getChatModelFallbackChain('gpt-5.2', 'openai'),
      ['gpt-5.2', 'gpt-5', 'gpt-4o-mini']
    );
    assert.deepEqual(
      workflow.getChatModelFallbackChain('gemini-2.5-pro-preview-05-06', 'google'),
      ['gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash']
    );
  });
});

test('chat completion fallback retries missing OpenAI models with normalized payloads', async () => {
  const calls = [];

  await withWorkflowModule(
    {
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push({ url, body, headers: init.headers });

        if (body.model === 'gpt-5.2') {
          return jsonResponse(false, { error: { message: 'model not found' } }, 'Not Found');
        }

        return jsonResponse(true, { choices: [{ message: { content: 'ok' } }] });
      },
    },
    async (workflow) => {
      const result = await workflow.fetchChatCompletionsWithModelFallback(
        'openai-key',
        {
          messages: [{ role: 'user', content: 'hello' }],
          max_tokens: 24,
          temperature: 0.3,
        },
        'gpt-5.2',
        { provider: 'openai', apiBaseUrl: 'https://api.openai.com/v1' }
      );

      assert.equal(result.usedModel, 'gpt-5');
      assert.equal(calls.length, 2);
      assert.equal(calls[1].body.model, 'gpt-5');
      assert.equal(calls[1].body.max_completion_tokens, 24);
      assert.equal('max_tokens' in calls[1].body, false);
      assert.equal('temperature' in calls[1].body, false);
      assert.equal(calls[1].headers.Authorization, 'Bearer openai-key');
    }
  );
});

test('Claude fallback converts text-only OpenAI chat payloads after non-model API errors', async () => {
  const calls = [];

  await withWorkflowModule(
    {
      env: { ANTHROPIC_API_KEY: 'anthropic-key' },
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push({ url, body, headers: init.headers });

        if (url.includes('api.anthropic.com')) {
          return jsonResponse(true, {
            content: [{ type: 'text', text: 'claude ok' }],
          });
        }

        return jsonResponse(false, { error: { message: 'quota exceeded' } }, 'Too Many Requests');
      },
    },
    async (workflow) => {
      const result = await workflow.fetchChatCompletionsWithModelFallback(
        'openai-key',
        {
          messages: [
            { role: 'system', content: 'Be brief.' },
            { role: 'user', content: 'hello' },
          ],
          max_tokens: 16,
        },
        'gpt-4o-mini',
        { provider: 'openai', apiBaseUrl: 'https://api.openai.com/v1' }
      );

      const anthropicCall = calls.find((call) => call.url.includes('api.anthropic.com'));
      assert.equal(result.usedModel, 'claude-3-5-haiku-latest');
      assert.equal(result.data.choices[0].message.content, 'claude ok');
      assert.ok(anthropicCall);
      assert.equal(anthropicCall.headers['x-api-key'], 'anthropic-key');
      assert.equal(anthropicCall.body.system, 'Be brief.');
      assert.deepEqual(anthropicCall.body.messages, [{ role: 'user', content: 'hello' }]);
      assert.equal(anthropicCall.body.max_tokens, 256);
    }
  );
});

test('Claude fallback is skipped for vision payloads so image requests fail safely', async () => {
  const calls = [];

  await withWorkflowModule(
    {
      env: { ANTHROPIC_API_KEY: 'anthropic-key' },
      fetchImpl: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return jsonResponse(false, { error: { message: 'quota exceeded' } }, 'Too Many Requests');
      },
    },
    async (workflow) => {
      await assert.rejects(
        workflow.fetchChatCompletionsWithModelFallback(
          'openai-key',
          {
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'describe image' },
                  { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
                ],
              },
            ],
          },
          'gpt-4o',
          { provider: 'openai', apiBaseUrl: 'https://api.openai.com/v1' }
        ),
        /quota exceeded/
      );

      assert.equal(calls.some((call) => call.url.includes('api.anthropic.com')), false);
    }
  );
});
