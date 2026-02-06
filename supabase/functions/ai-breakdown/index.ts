import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const levelPrompts: Record<string, string> = {
  'child': 'Explain this like I\'m 5 years old. Use very simple words, fun comparisons, and short sentences. Make it playful!',
  'elementary': 'Explain this for an elementary school student (ages 8-10). Use simple vocabulary and relatable examples.',
  'highschool': 'Explain this for a high school student. Use clear language with some technical terms, and provide context.',
  'college': 'Explain this for a college student. Be thorough, use proper terminology, and include relevant details.',
  'phd': 'Explain this at an expert/PhD level. Be precise, use technical jargon, and include nuanced details.',
  'wiseman': 'Explain this like a wise sage or philosopher. Be profound, use metaphors, and provide deeper insights about life and meaning.'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { text, level } = body || {}

    if (!text) {
      throw new Error('Text is required')
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const systemPrompt = levelPrompts[level] || levelPrompts['college']

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please explain this text:\n\n${text}` }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }

    const { data } = await fetchChatCompletionsWithModelFallback(openaiKey, payload, models.chatTextModel)
    const breakdown = String(data?.choices?.[0]?.message?.content || '').trim()

    return new Response(
      JSON.stringify({ breakdown }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


