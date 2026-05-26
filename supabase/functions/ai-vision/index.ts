import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { TextCreditGate } from "../_shared/ai_workflow.ts"
import { guardAiModelText } from "../_shared/ai_output_guard.ts"

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
    const { imageBase64 } = body || {}
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('imageBase64 is required')
    }

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)
    const apiKey = getApiKeyForResolved(models)

    const payload = {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this person in detail for creating a cartoon avatar. Focus on: face shape, hair style and color, eye color, glasses/facial hair if any, skin tone, distinctive features, and overall vibe. Be specific and descriptive. Keep it under 100 words.'
            },
            {
              type: 'image_url',
              image_url: { url: imageBase64 }
            }
          ]
        }
      ],
      max_tokens: 200
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatVisionModel, models)
    let description = String(data?.choices?.[0]?.message?.content || '').trim()
    const guarded = await guardAiModelText(gate.supabase, gate.userId, description, 'ai-vision', corsHeaders, { apiKey })
    if (guarded instanceof Response) return guarded
    description = guarded

    // Decrement weighted text credits after successful generation
    const credits = await decrementTextCredits(gate, getTextCreditCost(models.provider, models.preset))

    return new Response(
      JSON.stringify({ description, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

