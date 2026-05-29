import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { TextCreditGate } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

const levelPrompts: Record<string, string> = {
  'child': `Explain this like I'm 5 years old. Use very simple words, fun comparisons, and short sentences. Make it playful!${formatRules}`,
  'elementary': `Explain this for an elementary school student (ages 8-10). Use simple vocabulary and relatable examples.${formatRules}`,
  'highschool': `Explain this for a high school student. Use clear language with some technical terms, and provide context.${formatRules}`,
  'college': `Explain this for a college student. Be thorough, use proper terminology, and include relevant details.${formatRules}`,
  'phd': `Explain this at an expert/PhD level. Be precise, use technical jargon, and include nuanced details.${formatRules}`,
  'wiseman': `Explain this like a wise sage or philosopher. Be profound, use metaphors, and provide deeper insights about life and meaning.${formatRules}`
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
    const { text, level } = body || {}

    if (!text) {
      throw new Error('Text is required')
    }

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)
    const apiKey = getApiKeyForResolved(models)

    const systemPrompt = levelPrompts[level] || levelPrompts['college']

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please explain this text:\n\n${text}` }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    const breakdown = String(data?.choices?.[0]?.message?.content || '').trim()

    // Decrement weighted text credits after successful generation
    const credits = await decrementTextCredits(gate, getTextCreditCost(models.provider, models.preset))

    return new Response(
      JSON.stringify({ breakdown, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


