import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(
  join(__dirname, '..', 'supabase/functions/_shared/ai_summary_grounding.js'),
).href;
const {
  GATEWAY_BASE_URL,
  GATEWAY_SEARCH_MODEL,
  GATEWAY_SONAR_MODEL,
  buildGroundingQuery,
  extractGatewayCitations,
  extractGeminiGroundingChunks,
  extractSerperOrganic,
  hasCiteableHttpUrl,
  normalizeGroundedSources,
  searchSummarySources,
  shouldGroundWeb,
} = await import(url);

assert.equal(hasCiteableHttpUrl('See https://cursor.com/docs'), true);
assert.equal(hasCiteableHttpUrl('Potential Benefits of Cursor AI'), false);

assert.equal(
  shouldGroundWeb({
    groundWeb: true,
    text: 'Potential Benefits and Drawbacks of Using Cursor AI',
  }),
  true,
);
assert.equal(
  shouldGroundWeb({
    groundWeb: true,
    text: '[Source: Docs | https://cursor.com/docs]\nEssay',
  }),
  false,
);
assert.equal(shouldGroundWeb({ text: 'Potential Benefits and Drawbacks of Using Cursor AI' }), false);
assert.equal(
  shouldGroundWeb({
    groundWeb: true,
    text: 'hello',
    question: 'Generate a short note title. Return ONLY the title, nothing else.',
  }),
  false,
);
assert.equal(shouldGroundWeb({ groundWeb: true, text: 'short' }), false);

assert.match(
  buildGroundingQuery({ text: 'Potential Benefits and Drawbacks of Using Cursor AI\nMore essay text.' }),
  /Cursor AI/,
);
assert.equal(
  buildGroundingQuery({ text: 'Essay', question: 'What are the drawbacks of Cursor AI?' }),
  'What are the drawbacks of Cursor AI?',
);

const gemini = extractGeminiGroundingChunks({
  candidates: [{
    groundingMetadata: {
      groundingChunks: [
        { web: { title: 'Cursor Docs', uri: 'https://cursor.com/docs' } },
        { web: { title: 'Fake', uri: 'javascript:alert(1)' } },
        { web: { title: 'Cursor Docs', uri: 'https://cursor.com/docs' } },
      ],
    },
  }],
});
assert.equal(gemini.length, 1);
assert.equal(gemini[0].url, 'https://cursor.com/docs');
assert.equal(gemini[0].domain, 'cursor.com');

const serper = extractSerperOrganic({
  organic: [
    { title: 'Cursor', link: 'https://cursor.com' },
    { title: 'No link' },
  ],
});
assert.equal(serper.length, 1);
assert.equal(normalizeGroundedSources([{ title: 'X' }]).length, 0);

const fromResponses = extractGatewayCitations({
  output: [{
    type: 'message',
    content: [{
      type: 'output_text',
      annotations: [{
        type: 'url_citation',
        url_citation: { title: 'Cursor', url: 'https://cursor.com' },
      }],
    }],
  }],
});
assert.equal(fromResponses.length, 1);
assert.equal(fromResponses[0].url, 'https://cursor.com');

const fromSonarFields = extractGatewayCitations({
  citations: ['https://cursor.com/docs', 'javascript:alert(1)'],
  search_results: [{ title: 'Cursor Docs', url: 'https://cursor.com/docs' }],
});
assert.equal(fromSonarFields.length, 1);
assert.equal(fromSonarFields[0].url, 'https://cursor.com/docs');

const calledUrls = [];
const fromGatewayFetch = await searchSummarySources('benefits and drawbacks of Cursor AI', {
  env: {
    AI_GATEWAY_API_KEY: 'test-gateway-key',
    GOOGLE_AI_KEY: 'test-gemini-key',
    SERPER_API_KEY: 'test-serper-key',
  },
  fetchImpl: async (href, init) => {
    calledUrls.push(String(href));
    const body = JSON.parse(String(init?.body || '{}'));
    assert.equal(body.model, GATEWAY_SEARCH_MODEL);
    assert.deepEqual(body.tools, [{ type: 'web_search' }]);
    assert.match(String(init?.headers?.Authorization || ''), /Bearer test-gateway-key/);
    return {
      ok: true,
      json: async () => ({
        output: [{
          type: 'message',
          content: [{
            annotations: [{ url_citation: { title: 'Cursor', url: 'https://cursor.com' } }],
          }],
        }],
      }),
    };
  },
});
assert.equal(fromGatewayFetch.length, 1);
assert.equal(fromGatewayFetch[0].url, 'https://cursor.com');
assert.ok(calledUrls.every((href) => href.startsWith(GATEWAY_BASE_URL)));
assert.ok(!calledUrls.some((href) => href.includes('generativelanguage.googleapis.com')));
assert.ok(!calledUrls.some((href) => href.includes('serper.dev')));

const sonarUrls = [];
const fromSonarFallback = await searchSummarySources('benefits and drawbacks of Cursor AI', {
  env: { VERCEL_AI_GATEWAY_API_KEY: 'alias-key' },
  fetchImpl: async (href) => {
    sonarUrls.push(String(href));
    if (String(href).endsWith('/responses')) {
      return { ok: true, json: async () => ({ output: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        citations: ['https://cursor.com'],
        choices: [{ message: { content: 'ok' } }],
      }),
    };
  },
});
assert.equal(fromSonarFallback.length, 1);
assert.ok(sonarUrls.some((href) => href.endsWith('/chat/completions')));
assert.match(GATEWAY_SONAR_MODEL, /^perplexity\//);

let geminiCalled = false;
const noGateway = await searchSummarySources('benefits and drawbacks of Cursor AI', {
  env: { GOOGLE_AI_KEY: 'test-key', SERPER_API_KEY: 'serper' },
  fetchImpl: async () => {
    geminiCalled = true;
    return { ok: true, json: async () => ({}) };
  },
});
assert.equal(noGateway.length, 0);
assert.equal(geminiCalled, false);

const searchFailed = await searchSummarySources('benefits and drawbacks of Cursor AI', {
  env: { AI_GATEWAY_API_KEY: 'test-key' },
  fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
});
assert.equal(searchFailed.length, 0);

console.log('ai-summary-grounding.test.mjs ok');
