export const AI_INPUT_MAX_CHARS = 12000

const SHORT_QUERY_MAX_WORDS = 4
const SHORT_QUERY_MAX_CHARS = 120
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu
const SCRIPT_LIKE_PATTERN = /(<\/?[a-z][^>]*>|=>|function\s*\(|\bconst\b|\blet\b|\bvar\b|;\s*$|\{[\s\S]*\})/i

type ProviderDescriptor = {
  id: string
  label: string
  requiresKey: boolean
  keyEnv?: string
}

export type KnowledgeSignal = {
  source: string
  snippet: string
  url?: string
  strength: 'strong' | 'weak'
}

export type ProviderStatus = {
  id: string
  label: string
  requiresKey: boolean
  keyEnv?: string
  ready: boolean
  checked: boolean
  ok: boolean
  error?: string
}

export type ShortInputEnrichment = {
  normalizedInput: string
  isShortQuery: boolean
  isMeaningful: boolean
  message?: string
  signals: KnowledgeSignal[]
  providers: ProviderStatus[]
  degraded: boolean
}

const PROVIDERS: ProviderDescriptor[] = [
  { id: 'dictionary_api', label: 'DictionaryAPI.dev', requiresKey: false },
  { id: 'wikipedia', label: 'Wikipedia', requiresKey: false },
  { id: 'urban_dictionary', label: 'Urban Dictionary', requiresKey: false },
  { id: 'datamuse', label: 'Datamuse', requiresKey: false },
  { id: 'semantic_scholar', label: 'Semantic Scholar', requiresKey: true, keyEnv: 'SEMANTIC_SCHOLAR_API_KEY' },
  { id: 'openalex', label: 'OpenAlex', requiresKey: true, keyEnv: 'OPENALEX_API_KEY' },
  { id: 'github', label: 'GitHub', requiresKey: true, keyEnv: 'GITHUB_TOKEN' },
  { id: 'stackexchange', label: 'Stack Exchange', requiresKey: true, keyEnv: 'STACKEXCHANGE_KEY' },
]

function normalizeInput(rawInput: unknown): string {
  return String(rawInput ?? '').replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  if (!text) return 0
  const words = text.match(WORD_PATTERN)
  return Array.isArray(words) ? words.length : 0
}

function sanitizeSnippet(value: unknown, maxChars = 260): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars)
}

function isShortQuery(text: string, words: number): boolean {
  return words <= SHORT_QUERY_MAX_WORDS && text.length <= SHORT_QUERY_MAX_CHARS
}

function isScriptLikeShortInput(text: string, words: number): boolean {
  if (!text) return false
  if (words > SHORT_QUERY_MAX_WORDS) return false
  return SCRIPT_LIKE_PATTERN.test(text)
}

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 3500): Promise<{ ok: boolean; status?: number; data?: any; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` }
    }
    const data = await response.json()
    return { ok: true, status: response.status, data }
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message || error || 'request failed') }
  } finally {
    clearTimeout(timer)
  }
}

async function lookupDictionaryApi(term: string): Promise<KnowledgeSignal[]> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`
  const result = await fetchJsonWithTimeout(url, {}, 3000)
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return []
  const first = result.data[0] || {}
  const meaning = Array.isArray(first.meanings) ? first.meanings[0] : null
  const definition = Array.isArray(meaning?.definitions) ? meaning.definitions[0]?.definition : ''
  const pos = String(meaning?.partOfSpeech || '').trim()
  const snippet = sanitizeSnippet(`${pos ? `${pos}: ` : ''}${definition}`)
  if (!snippet) return []
  return [{
    source: 'DictionaryAPI.dev',
    snippet,
    url,
    strength: 'strong',
  }]
}

async function lookupWikipedia(term: string): Promise<KnowledgeSignal[]> {
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`
  let summary = await fetchJsonWithTimeout(summaryUrl, {}, 3200)

  if (!summary.ok) {
    const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(term)}&limit=1`
    const search = await fetchJsonWithTimeout(searchUrl, {}, 3200)
    const title = search.ok && Array.isArray(search.data?.pages) && search.data.pages[0]?.title
      ? String(search.data.pages[0].title)
      : ''
    if (!title) return []
    summary = await fetchJsonWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {}, 3200)
  }

  if (!summary.ok) return []
  const extract = sanitizeSnippet(summary.data?.extract, 320)
  const pageUrl = String(summary.data?.content_urls?.desktop?.page || summaryUrl)
  if (!extract) return []
  return [{
    source: 'Wikipedia',
    snippet: extract,
    url: pageUrl,
    strength: 'strong',
  }]
}

async function lookupUrbanDictionary(term: string): Promise<KnowledgeSignal[]> {
  const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`
  const result = await fetchJsonWithTimeout(url, {}, 3200)
  if (!result.ok || !Array.isArray(result.data?.list) || result.data.list.length === 0) return []

  const entries = result.data.list
    .slice(0, 6)
    .sort((a: any, b: any) => Number(b?.thumbs_up || 0) - Number(a?.thumbs_up || 0))
  const best = entries[0]
  const definition = sanitizeSnippet(String(best?.definition || '').replace(/\[|\]/g, ''), 320)
  if (!definition) return []
  return [{
    source: 'Urban Dictionary',
    snippet: definition,
    url: String(best?.permalink || url),
    strength: 'strong',
  }]
}

async function lookupDatamuse(term: string): Promise<KnowledgeSignal[]> {
  const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(term)}&max=5`
  const result = await fetchJsonWithTimeout(url, {}, 2500)
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return []
  const words = result.data
    .map((item: any) => sanitizeSnippet(item?.word, 40))
    .filter(Boolean)
    .slice(0, 5)
  if (words.length === 0) return []
  return [{
    source: 'Datamuse',
    snippet: `Related terms: ${words.join(', ')}`,
    url,
    strength: 'weak',
  }]
}

async function lookupSemanticScholar(term: string, apiKey: string): Promise<KnowledgeSignal[]> {
  if (!apiKey) return []
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(term)}&limit=1&fields=title,abstract,url`
  const result = await fetchJsonWithTimeout(url, {
    headers: {
      'x-api-key': apiKey,
    },
  }, 3500)
  if (!result.ok || !Array.isArray(result.data?.data) || result.data.data.length === 0) return []
  const paper = result.data.data[0] || {}
  const title = sanitizeSnippet(paper?.title, 160)
  const abstract = sanitizeSnippet(paper?.abstract, 220)
  const snippet = sanitizeSnippet(`${title}${abstract ? ` — ${abstract}` : ''}`, 320)
  if (!snippet) return []
  return [{
    source: 'Semantic Scholar',
    snippet,
    url: String(paper?.url || 'https://api.semanticscholar.org/'),
    strength: 'weak',
  }]
}

async function lookupOpenAlex(term: string, apiKey: string): Promise<KnowledgeSignal[]> {
  if (!apiKey) return []
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(term)}&per_page=1&api_key=${encodeURIComponent(apiKey)}`
  const result = await fetchJsonWithTimeout(url, {}, 3500)
  if (!result.ok || !Array.isArray(result.data?.results) || result.data.results.length === 0) return []
  const work = result.data.results[0] || {}
  const title = sanitizeSnippet(work?.title, 180)
  if (!title) return []
  return [{
    source: 'OpenAlex',
    snippet: `Scholarly context: ${title}`,
    url: String(work?.id || 'https://openalex.org'),
    strength: 'weak',
  }]
}

function initProviderStatuses(): ProviderStatus[] {
  return PROVIDERS.map((provider) => {
    const key = provider.keyEnv ? String(Deno.env.get(provider.keyEnv) || '').trim() : ''
    const ready = provider.requiresKey ? !!key : true
    return {
      id: provider.id,
      label: provider.label,
      requiresKey: provider.requiresKey,
      keyEnv: provider.keyEnv,
      ready,
      checked: false,
      ok: false,
    }
  })
}

function markProviderChecked(statuses: ProviderStatus[], id: string, ok: boolean, error = ''): void {
  const entry = statuses.find((item) => item.id === id)
  if (!entry) return
  entry.checked = true
  entry.ok = ok
  if (!ok && error) entry.error = error
}

export async function enrichShortInputMeaning(rawInput: unknown): Promise<ShortInputEnrichment> {
  const normalizedInput = normalizeInput(rawInput)
  const words = countWords(normalizedInput)
  const shortQuery = isShortQuery(normalizedInput, words)
  const providerStatuses = initProviderStatuses()

  if (!normalizedInput) {
    return {
      normalizedInput,
      isShortQuery: shortQuery,
      isMeaningful: false,
      message: 'Please enter at least one meaningful word or phrase.',
      signals: [],
      providers: providerStatuses,
      degraded: false,
    }
  }

  if (normalizedInput.length > AI_INPUT_MAX_CHARS) {
    return {
      normalizedInput,
      isShortQuery: shortQuery,
      isMeaningful: false,
      message: `Input exceeds the ${AI_INPUT_MAX_CHARS} character limit.`,
      signals: [],
      providers: providerStatuses,
      degraded: false,
    }
  }

  if (words === 0) {
    return {
      normalizedInput,
      isShortQuery: shortQuery,
      isMeaningful: false,
      message: 'Please enter at least one meaningful word or phrase.',
      signals: [],
      providers: providerStatuses,
      degraded: false,
    }
  }

  if (isScriptLikeShortInput(normalizedInput, words)) {
    return {
      normalizedInput,
      isShortQuery: shortQuery,
      isMeaningful: false,
      message: 'Sorry, we do not understand this meaning. Please try a significant understanding.',
      signals: [],
      providers: providerStatuses,
      degraded: false,
    }
  }

  if (!shortQuery) {
    return {
      normalizedInput,
      isShortQuery: false,
      isMeaningful: true,
      signals: [],
      providers: providerStatuses,
      degraded: false,
    }
  }

  const signals: KnowledgeSignal[] = []

  const dictionaryPromise = lookupDictionaryApi(normalizedInput)
    .then((items) => {
      markProviderChecked(providerStatuses, 'dictionary_api', true)
      signals.push(...items)
    })
    .catch((error) => {
      markProviderChecked(providerStatuses, 'dictionary_api', false, String(error))
    })

  const wikiPromise = lookupWikipedia(normalizedInput)
    .then((items) => {
      markProviderChecked(providerStatuses, 'wikipedia', true)
      signals.push(...items)
    })
    .catch((error) => {
      markProviderChecked(providerStatuses, 'wikipedia', false, String(error))
    })

  const urbanPromise = lookupUrbanDictionary(normalizedInput)
    .then((items) => {
      markProviderChecked(providerStatuses, 'urban_dictionary', true)
      signals.push(...items)
    })
    .catch((error) => {
      markProviderChecked(providerStatuses, 'urban_dictionary', false, String(error))
    })

  const datamusePromise = lookupDatamuse(normalizedInput)
    .then((items) => {
      markProviderChecked(providerStatuses, 'datamuse', true)
      signals.push(...items)
    })
    .catch((error) => {
      markProviderChecked(providerStatuses, 'datamuse', false, String(error))
    })

  const semanticScholarKey = String(Deno.env.get('SEMANTIC_SCHOLAR_API_KEY') || '').trim()
  const semanticScholarPromise = semanticScholarKey
    ? lookupSemanticScholar(normalizedInput, semanticScholarKey)
      .then((items) => {
        markProviderChecked(providerStatuses, 'semantic_scholar', true)
        signals.push(...items)
      })
      .catch((error) => {
        markProviderChecked(providerStatuses, 'semantic_scholar', false, String(error))
      })
    : Promise.resolve()

  const openAlexKey = String(Deno.env.get('OPENALEX_API_KEY') || '').trim()
  const openAlexPromise = openAlexKey
    ? lookupOpenAlex(normalizedInput, openAlexKey)
      .then((items) => {
        markProviderChecked(providerStatuses, 'openalex', true)
        signals.push(...items)
      })
      .catch((error) => {
        markProviderChecked(providerStatuses, 'openalex', false, String(error))
      })
    : Promise.resolve()

  await Promise.allSettled([
    dictionaryPromise,
    wikiPromise,
    urbanPromise,
    datamusePromise,
    semanticScholarPromise,
    openAlexPromise,
  ])

  const strongSignals = signals.filter((signal) => signal.strength === 'strong')
  const checkedProviders = providerStatuses.filter((provider) => provider.checked)
  const noProviderCouldRun = checkedProviders.length === 0

  if (strongSignals.length > 0) {
    return {
      normalizedInput,
      isShortQuery: true,
      isMeaningful: true,
      signals,
      providers: providerStatuses,
      degraded: false,
    }
  }

  if (noProviderCouldRun) {
    return {
      normalizedInput,
      isShortQuery: true,
      isMeaningful: true,
      signals,
      providers: providerStatuses,
      degraded: true,
    }
  }

  return {
    normalizedInput,
    isShortQuery: true,
    isMeaningful: false,
    message: 'Sorry, we do not understand this meaning. Please try a significant understanding.',
    signals,
    providers: providerStatuses,
    degraded: false,
  }
}

export function buildKnowledgeContext(query: string, signals: KnowledgeSignal[]): string {
  const title = sanitizeSnippet(query, 120)
  const lines = signals
    .slice(0, 6)
    .map((signal) => `- ${signal.source}: ${sanitizeSnippet(signal.snippet, 300)}`)
  if (!title || lines.length === 0) return ''
  return [
    `Term or phrase: ${title}`,
    'Knowledge signals:',
    ...lines,
  ].join('\n')
}
