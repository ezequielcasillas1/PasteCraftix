import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import { AI_INPUT_MAX_CHARS, enrichShortInputMeaning, buildKnowledgeContext } from "../_shared/knowledge_enrichment.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Credit gate: authenticate + check text credits
    const gate = await requireTextCredits(req)
    if (gate instanceof Response) return gate

    const body = await req.json().catch(() => ({}))
    const { text, question, generateQuestions } = body || {}

    const rawText = String(text || '').trim()
    const rawQuestion = String(question || '').trim()

    if (!rawText) {
      throw new Error('Text is required')
    }
    if (rawText.length > AI_INPUT_MAX_CHARS) {
      throw new Error(`Input exceeds the ${AI_INPUT_MAX_CHARS} character limit`)
    }
    if (rawQuestion.length > AI_INPUT_MAX_CHARS) {
      throw new Error(`Question exceeds the ${AI_INPUT_MAX_CHARS} character limit`)
    }

    const enrichment = await enrichShortInputMeaning(rawText)
    if (!enrichment.isMeaningful) {
      return new Response(
        JSON.stringify({ error: enrichment.message || 'Meaningful input is required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      )
    }
    const knowledgeContext = buildKnowledgeContext(enrichment.normalizedInput, enrichment.signals)

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)
    const apiKey = getApiKeyForResolved(models)

    let systemPrompt: string
    let userPrompt: string

    const formatRules = `
FORMATTING RULES (strict):
- Use Markdown formatting: headings (#, ##, ###), bold (**text**), italic (*text*), bullet lists (- item), numbered lists (1. item), tables, and code blocks.
- For math/formulas use LaTeX notation: inline math with $...$, display math with $$...$$.  Example: $E = mc^2$ or $$\\frac{a}{b} = c$$
- For diagrams or visual explanations, use Mermaid syntax inside a fenced code block tagged "mermaid". Example: \`\`\`mermaid\\ngraph TD\\nA-->B\\n\`\`\`
- Use tables (Markdown pipe tables) for comparisons, data, or structured info.
- Use code blocks (\`\`\`lang) for any code snippets, with the language tag.
- Structure responses with clear headings and sub-sections.
- Never use // or \\\\ as decorative line prefixes or separators.
- Be detailed but minimal. Every sentence should add value.`

    if (generateQuestions) {
      systemPrompt = `You are a helpful assistant. Generate 4 short, insightful questions that help the user understand the provided input. Return ONLY the questions, one per line, no numbering or bullets.${formatRules}`
      userPrompt = knowledgeContext
        ? `Generate 4 questions using this input and knowledge context.\n\nInput:\n${rawText}\n\n${knowledgeContext}`
        : `Generate 4 questions about this text:\n\n${rawText}`
    } else if (rawQuestion) {
      systemPrompt = `You are a helpful assistant. Answer the question based on the provided text. Be concise but thorough.${formatRules}`
      userPrompt = knowledgeContext
        ? `Text: ${rawText}\n\n${knowledgeContext}\n\nQuestion: ${rawQuestion}`
        : `Text: ${rawText}\n\nQuestion: ${rawQuestion}`
    } else {
      systemPrompt = `You are a helpful assistant. Provide a clear, concise summary of the text.${formatRules}`
      userPrompt = knowledgeContext
        ? `Summarize this input.\n\nInput:\n${rawText}\n\n${knowledgeContext}`
        : `Summarize this text:\n\n${rawText}`
    }

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    const result = String(data?.choices?.[0]?.message?.content || '').trim()

    // Decrement weighted text credits after successful generation
    const credits = await decrementTextCredits(gate, getTextCreditCost(models.provider, models.preset))

    if (generateQuestions) {
      const questions = result.split('\n').filter((q: string) => q.trim()).slice(0, 4)
      return new Response(
        JSON.stringify({ questions, ...credits }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ summary: result, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


