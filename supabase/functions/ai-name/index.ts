import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  fetchChatCompletionsWithModelFallback,
  parseAiWorkflowFromBody,
  resolveModelsFromWorkflow,
  getApiKeyForResolved,
  requireAuthenticatedUser,
  checkAiNameRateLimit,
} from "../_shared/ai_workflow.ts"
import {
  FUNKY_ANIMALS,
  buildFallbackFunkyName,
  drawNextAnimal,
  isValidFunkyAnimalName,
} from "../_shared/animals.ts"

async function loadAnimalDeck(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('funky_animal_deck')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error('Failed to load animal deck')
  return data?.funky_animal_deck ?? null
}

async function saveAnimalDeck(supabase: any, userId: string, deck: { remaining: string[]; cycle: number }) {
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        funky_animal_deck: deck,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id', ignoreDuplicates: false },
    )

  if (error) throw new Error('Failed to save animal deck')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const gate = await requireAuthenticatedUser(req)
    if (gate instanceof Response) return gate

    const rateLimited = await checkAiNameRateLimit(gate.supabase, gate.userId)
    if (rateLimited) return rateLimited

    const body = await req.json().catch(() => ({}))
    const { userName } = body || {}

    if (!userName) {
      throw new Error('User name is required')
    }

    const safeName = String(userName).slice(0, 80)
    const savedDeck = await loadAnimalDeck(gate.supabase, gate.userId)
    const { animal: chosenAnimal, deck: nextDeck, cycleReset, cycleComplete } = drawNextAnimal(savedDeck, FUNKY_ANIMALS)

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)
    const apiKey = getApiKeyForResolved(models)

    const payload = {
      messages: [
        {
          role: 'system',
          content: `You are a creative name generator. Generate ONE unique, funky animal name that REMIXES the user's real name.

Rules:
- Output must be a SINGLE CamelCase token (no spaces, no quotes, no punctuation).
- Output must have EXACTLY 3 parts: [NameRemix][Descriptor][Animal].
  - Part 1 (NameRemix): playful twist on part of the user's real name (nickname, mashup, or spelling twist).
  - Part 2 (Descriptor): one short creative adjective (Zesty, Brave, Cosmic, Wild, Mighty, Radiant, etc.).
  - Part 3 (Animal): MUST be exactly "${chosenAnimal}" — do not substitute another animal.
- Mammals, birds, fish, reptiles, amphibians, insects, marine life, and mythical creatures are all allowed when they match the assigned animal.

Examples (for name "Ezekiel" with animal "Fox"): "EzeZestyFox", "ZekiBraveFox".
Return ONLY the generated name.`
        },
        {
          role: 'user',
          content: `Generate a funky AI name for: ${safeName}`
        }
      ],
      max_tokens: 50,
      temperature: 0.9
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    let aiName = String(data?.choices?.[0]?.message?.content || '').trim()

    if (!isValidFunkyAnimalName(aiName, safeName, FUNKY_ANIMALS, chosenAnimal)) {
      aiName = buildFallbackFunkyName(safeName, FUNKY_ANIMALS, chosenAnimal)
    }

    await saveAnimalDeck(gate.supabase, gate.userId, nextDeck)

    return new Response(
      JSON.stringify({
        aiName,
        animalUsed: chosenAnimal,
        animalsRemaining: nextDeck.remaining.length,
        cycle: nextDeck.cycle,
        cycleComplete,
        cycleReset,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
