/** Web grounding for ai-summary via Vercel AI Gateway. Keys stay in Edge secrets. */

import { wantsBareOutput } from './ai_summary_prompts.js';

const MAX_SOURCES = 6;
const MAX_QUERY = 240;
const MIN_QUERY = 12;
const SEARCH_TIMEOUT_MS = 8000;
const HTTP_URL_RE = /https?:\/\/\S+/i;

export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
export const GATEWAY_KEY_NAMES = [
  'AI_GATEWAY_API_KEY',
  'VERCEL_AI_GATEWAY_API_KEY',
  'AI_GATEWAY_KEY',
];
export const GATEWAY_SEARCH_MODEL = 'openai/gpt-4o-mini';
export const GATEWAY_SONAR_MODEL = 'perplexity/sonar';

function readEnvValue(env, name) {
  if (env && typeof env.get === 'function') return env.get(name);
  if (env && typeof env === 'object') return env[name];
  if (typeof Deno !== 'undefined') return Deno.env?.get?.(name);
  return '';
}

function peekEnv(names, env) {
  for (const name of names) {
    const value = String(readEnvValue(env, name) || '').trim();
    if (value) return value;
  }
  return '';
}

function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || '').trim());
}

function cleanUrl(value) {
  const raw = String(value || '').trim().replace(/[.,;:!?)]+$/, '');
  if (!isHttpUrl(raw)) return '';
  return raw.slice(0, 400);
}

function cleanTitle(value) {
  return String(value || '').trim().slice(0, 120);
}

export function sourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (_) {
    return '';
  }
}

export function normalizeGroundedSource(item) {
  if (!item || typeof item !== 'object') return null;
  const url = cleanUrl(item.url || item.uri || item.link);
  if (!url) return null;
  const title = cleanTitle(item.title) || sourceDomain(url);
  const domain = cleanTitle(item.domain) || sourceDomain(url);
  return { title, url, domain };
}

export function normalizeGroundedSources(list) {
  const sources = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const next = normalizeGroundedSource(item);
    if (!next || seen.has(next.url)) return;
    seen.add(next.url);
    sources.push(next);
  });
  return sources.slice(0, MAX_SOURCES);
}

export function hasCiteableHttpUrl(text) {
  return HTTP_URL_RE.test(String(text || ''));
}

function isUsableSearchQuestion(question) {
  return Boolean(question)
    && !wantsBareOutput(question)
    && !/^based on the previous/i.test(question);
}

export function buildGroundingQuery(opts) {
  const question = String(opts?.question || '').trim();
  if (isUsableSearchQuestion(question)) return question.slice(0, MAX_QUERY);
  const cleaned = String(opts?.text || '')
    .replace(/\[Source:[^\]]*\]/gi, '')
    .replace(/^#{1,3}\s+/gm, '')
    .trim();
  const firstLine = cleaned.split(/\r?\n/).find((line) => line.trim()) || '';
  const snippet = firstLine.length >= MIN_QUERY ? firstLine : cleaned;
  return snippet.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
}

function isGroundingBlocked(opts) {
  const blockers = [
    opts?.groundWeb !== true,
    opts?.generateQuestions,
    opts?.hasImage,
    wantsBareOutput(opts?.question),
    hasCiteableHttpUrl(opts?.text),
  ];
  return blockers.some(Boolean);
}

export function shouldGroundWeb(opts) {
  if (isGroundingBlocked(opts)) return false;
  return buildGroundingQuery(opts).length >= MIN_QUERY;
}

function chunkToSource(chunk) {
  const web = chunk?.web || chunk?.retrievedContext || {};
  return { title: web.title, url: web.uri || web.url };
}

export function extractGeminiGroundingChunks(json) {
  const chunks = json?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  return Array.isArray(chunks) ? normalizeGroundedSources(chunks.map(chunkToSource)) : [];
}

export function extractSerperOrganic(json) {
  return normalizeGroundedSources(json?.organic);
}

function asObject(value) {
  return value && typeof value === 'object' ? value : null;
}

function citationFields(value) {
  if (typeof value === 'string') return { url: value };
  const row = asObject(value);
  if (!row) return null;
  const cite = asObject(row.url_citation) || row;
  return {
    title: cite.title || row.title,
    url: cite.url || row.url || row.uri || row.link,
  };
}

function pushCitation(items, value) {
  const next = citationFields(value);
  if (next) items.push(next);
}

function collectMessageCitations(items, message) {
  if (!message || typeof message !== 'object') return;
  (Array.isArray(message.annotations) ? message.annotations : []).forEach((a) => pushCitation(items, a));
  (Array.isArray(message.citations) ? message.citations : []).forEach((c) => pushCitation(items, c));
}

function collectOutputCitations(items, output) {
  (Array.isArray(output) ? output : []).forEach((part) => {
    if (Array.isArray(part?.results)) part.results.forEach((row) => pushCitation(items, row));
    const content = Array.isArray(part?.content) ? part.content : [];
    content.forEach((block) => {
      (Array.isArray(block?.annotations) ? block.annotations : []).forEach((a) => pushCitation(items, a));
    });
  });
}

export function extractGatewayCitations(json) {
  if (!json || typeof json !== 'object') return [];
  const items = [];
  (Array.isArray(json.citations) ? json.citations : []).forEach((c) => pushCitation(items, c));
  (Array.isArray(json.search_results) ? json.search_results : []).forEach((row) => pushCitation(items, row));
  (Array.isArray(json.results) ? json.results : []).forEach((row) => pushCitation(items, row));
  collectMessageCitations(items, json.choices?.[0]?.message);
  collectOutputCitations(items, json.output);
  return normalizeGroundedSources(items);
}

async function fetchJson(fetchImpl, url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
  try {
    const resp = await fetchImpl(url, { ...init, signal: ctrl.signal });
    if (!resp?.ok) return null;
    return await resp.json().catch(() => null);
  } finally {
    clearTimeout(timer);
  }
}

function gatewayHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function searchPrompt(query) {
  return `Find the most relevant official or reputable web pages about this topic. Do not invent URLs.\nTopic: ${query}`;
}

async function searchWithGatewayResponses(query, apiKey, fetchImpl) {
  const json = await fetchJson(fetchImpl, `${GATEWAY_BASE_URL}/responses`, {
    method: 'POST',
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify({
      model: GATEWAY_SEARCH_MODEL,
      input: searchPrompt(query),
      tools: [{ type: 'web_search' }],
      max_output_tokens: 256,
    }),
  });
  return extractGatewayCitations(json);
}

async function searchWithGatewaySonar(query, apiKey, fetchImpl) {
  const json = await fetchJson(fetchImpl, `${GATEWAY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify({
      model: GATEWAY_SONAR_MODEL,
      messages: [
        { role: 'system', content: 'List only real source pages. Do not invent URLs.' },
        { role: 'user', content: searchPrompt(query) },
      ],
      max_tokens: 256,
      temperature: 0.2,
    }),
  });
  return extractGatewayCitations(json);
}

async function firstSearchHit(producers) {
  for (const produce of producers) {
    const found = await produce().catch(() => []);
    if (found.length) return found;
  }
  return [];
}

export async function searchSummarySources(query, deps = {}) {
  const q = String(query || '').trim();
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  if (q.length < MIN_QUERY || typeof fetchImpl !== 'function') return [];

  const gatewayKey = peekEnv(GATEWAY_KEY_NAMES, deps.env);
  if (!gatewayKey) return [];

  return firstSearchHit([
    () => searchWithGatewayResponses(q, gatewayKey, fetchImpl),
    () => searchWithGatewaySonar(q, gatewayKey, fetchImpl),
  ]);
}

export async function safeSearchSummarySources(query, deps = {}) {
  try {
    return await searchSummarySources(query, deps);
  } catch (_) {
    return [];
  }
}
