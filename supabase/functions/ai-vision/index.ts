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
    const description = String(data?.choices?.[0]?.message?.content || '').trim()

    // Decrement text credits after successful generation
    const credits = await decrementTextCredits(gate)

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

