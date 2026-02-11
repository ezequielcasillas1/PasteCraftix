import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits } from "../_shared/ai_workflow.ts"
import type { TextCreditGate } from "../_shared/ai_workflow.ts"

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

    if (!text) {
      throw new Error('Text is required')
    }

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
      systemPrompt = `You are a helpful assistant. Generate 4 short, insightful questions about the provided text. Return ONLY the questions, one per line, no numbering or bullets.${formatRules}`
      userPrompt = `Generate 4 questions about this text:\n\n${text}`
    } else if (question) {
      systemPrompt = `You are a helpful assistant. Answer the question based on the provided text. Be concise but thorough.${formatRules}`
      userPrompt = `Text: ${text}\n\nQuestion: ${question}`
    } else {
      systemPrompt = `You are a helpful assistant. Provide a clear, concise summary of the text.${formatRules}`
      userPrompt = `Summarize this text:\n\n${text}`
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

    // Decrement text credits after successful generation
    const credits = await decrementTextCredits(gate)

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


