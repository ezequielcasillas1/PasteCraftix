/** Prompt strategies for ai-summary (cite vs bare output). */

const FORMAT_RULES = `
FORMATTING RULES (strict):
- Use Markdown formatting: headings (#, ##, ###), bold (**text**), italic (*text*), bullet lists (- item), numbered lists (1. item), tables, and code blocks.
- For math/formulas use LaTeX notation: inline math with $...$, display math with $$...$$.
- For diagrams, use Mermaid in a fenced code block tagged "mermaid".
- Use tables for comparisons. Use code blocks for code.
- Never use // or \\\\ as decorative separators.
- Be detailed but minimal.`

const TEXT_CITATION_RULES = `
SOURCE REFERENCES:
- Base every claim on the provided text. Do not invent facts, titles, or URLs.
- After claims that come from a listed source, add a citation marker [1], [2], … matching Sources order.
- If a line like [Source: …] or a http(s) URL appears, end with ## Sources listing those titles/URLs only.
- If the text has no [Source: …] and no http(s) URL, do not add a Sources section and do not invent URLs.
- If the text is split by ---, treat each block as a separate source when it has a [Source: …] or URL.
- If a claim is not in the source, say so instead of guessing.`

const VISION_CITATION_RULES =
  ' Cite each claim with a short quote from the image or context. Use [1] markers that match ## Sources. Do not invent URLs.'

/** Title/category helpers ask for a bare string — skip citation chrome. */
export function wantsBareOutput(question) {
  const q = String(question || '').trim()
  if (!q) return false
  return /\breturn only\b|\boutput titles only\b|\bnothing else\b/i.test(q)
}

export function resolveSummaryPromptKind(opts) {
  if (opts?.generateQuestions) return 'questions'
  if (opts?.question) return 'qa'
  return 'summarize'
}

function formatGroundedSourceLines(sources) {
  return (Array.isArray(sources) ? sources : [])
    .map((item, index) => {
      const n = index + 1
      const label = [item?.title, item?.url].filter(Boolean).join(' — ')
      return `[${n}] ${label}`
    })
    .filter((line) => /https?:\/\//i.test(line))
    .join('\n')
}

function groundedCitationSuffix(sources) {
  const lines = formatGroundedSourceLines(sources)
  if (!lines) return TEXT_CITATION_RULES
  return `
SOURCE REFERENCES (required):
- Use ONLY these verified web sources. Do not invent titles or URLs.
${lines}
- After claims supported by a source, add [1], [2], … matching that list.
- End with ## Sources listing ONLY these sources in the same order.
- If a claim is not supported by these sources, say so instead of guessing.`
}

function citationSuffix(kind, question, hasImage, groundedSources) {
  if (kind === 'questions') return ''
  if (wantsBareOutput(question)) return ''
  if (groundedSources.length) return groundedCitationSuffix(groundedSources)
  return hasImage ? VISION_CITATION_RULES : TEXT_CITATION_RULES
}

function buildVisionPrompts(kind, text, question, cite) {
  if (kind === 'questions') {
    return {
      systemPrompt: 'Generate exactly 4 short insightful questions about this image. Return ONLY the questions, one per line, no numbering.',
      userPrompt: `Context text (may be a placeholder):\n${text}`,
    }
  }
  if (kind === 'qa') {
    return {
      systemPrompt: `Answer the question using the image and any context text. Be concise but thorough. Use Markdown when helpful.${cite}`,
      userPrompt: `Context: ${text}\n\nQuestion: ${question}`,
    }
  }
  return {
    systemPrompt: `Describe and summarize this image clearly. Use Markdown headings and bullets when helpful.${cite}`,
    userPrompt: `Context text (may be a placeholder):\n${text}`,
  }
}

function buildPlainTextPrompts(kind, text, question, cite) {
  if (kind === 'questions') {
    return {
      systemPrompt: `You are a helpful assistant. Generate 4 short, insightful questions about the provided text. Return ONLY the questions, one per line, no numbering or bullets.${FORMAT_RULES}`,
      userPrompt: `Generate 4 questions about this text:\n\n${text}`,
    }
  }
  if (kind === 'qa') {
    return {
      systemPrompt: `You are a helpful assistant. Answer the question based on the provided text. Be concise but thorough.${FORMAT_RULES}${cite}`,
      userPrompt: `Text: ${text}\n\nQuestion: ${question}`,
    }
  }
  return {
    systemPrompt: `You are a helpful assistant. Provide a clear, concise summary of the text.${FORMAT_RULES}${cite}`,
    userPrompt: `Summarize this text:\n\n${text}`,
  }
}

export function buildTextPrompts(opts) {
  const text = String(opts?.text || '')
  const question = opts?.question
  const hasImage = !!opts?.hasImage
  const kind = resolveSummaryPromptKind(opts)
  const groundedSources = Array.isArray(opts?.groundedSources) ? opts.groundedSources : []
  const cite = citationSuffix(kind, question, hasImage, groundedSources)
  return hasImage
    ? buildVisionPrompts(kind, text, question, cite)
    : buildPlainTextPrompts(kind, text, question, cite)
}
