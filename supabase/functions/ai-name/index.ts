import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { userName } = body || {}

    if (!userName) {
      throw new Error('User name is required')
    }

    const animals = [
      'Rabbit','Tiger','Dragon','Fox','Wolf','Bear','Panda','Lion','Eagle','Phoenix','Unicorn','Owl','Cat','Dog','Monkey','Penguin','Koala','Raccoon',
      'Shark','Dolphin','Cheetah','Leopard','Panther','Otter','Lynx','Jaguar','Cougar','Sloth','Badger','Moose','Bison','Rhino','Elephant','Giraffe','Zebra','Kangaroo',
      'Platypus','Hamster','Ferret','Squirrel','Chipmunk','Hawk','Falcon','Raven','Crow','Parrot','Toucan','Flamingo','Peacock','Swan','Hummingbird',
      'Octopus','Whale','Orca','Seal','Walrus','Seahorse','Stingray','Snake','Gecko','Chameleon','Turtle','Crocodile','Alligator','Griffin','Hydra','Pegasus','Kraken'
    ]

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)

    const payload = {
      messages: [
        {
          role: 'system',
          content: `You are a creative name generator. Generate ONE unique, funky animal name that REMIXES the user's real name.

Rules:
- Output must be a SINGLE token (no spaces, no quotes, no punctuation).
- Output must be CamelCase.
- Output must END with ONE Animal from this list (exactly): Rabbit, Tiger, Dragon, Fox, Wolf, Bear, Panda, Lion, Eagle, Phoenix, Unicorn, Owl, Cat, Dog, Monkey, Penguin, Koala, Raccoon, Shark, Dolphin, Cheetah, Leopard, Panther, Otter, Lynx, Jaguar, Cougar, Sloth, Badger, Moose, Bison, Rhino, Elephant, Giraffe, Zebra, Kangaroo, Platypus, Hamster, Ferret, Squirrel, Chipmunk, Hawk, Falcon, Raven, Crow, Parrot, Toucan, Flamingo, Peacock, Swan, Hummingbird, Octopus, Whale, Orca, Seal, Walrus, Seahorse, Stingray, Snake, Gecko, Chameleon, Turtle, Crocodile, Alligator, Griffin, Hydra, Pegasus, Kraken.
- The prefix must clearly remix the user's name (use a playful variation of part of the name, like a nickname/mashup/spelling twist), then optionally add an adjective, then the Animal.

Examples (for name "Ezekiel"): "EzeZestyFox", "ZekiBraveWolf".
Return ONLY the generated name.`
        },
        {
          role: 'user',
          content: `Generate a funky AI name for: ${userName}`
        }
      ],
      max_tokens: 50,
      temperature: 0.9
    }

    const { data } = await fetchChatCompletionsWithModelFallback(openaiKey, payload, models.chatTextModel)
    let aiName = String(data?.choices?.[0]?.message?.content || '').trim()

    // Validate format (single token, ends with known Animal, and remixes userName)
    const cleaned = String(userName).replace(/[^a-zA-Z]/g, '')
    const remixNeedle = cleaned.slice(0, 2).toLowerCase()
    const endsWithAnimal = new RegExp(`(${animals.join('|')})$`).test(aiName)
    const singleToken = /^[A-Za-z]+$/.test(aiName)
    const includesRemix = remixNeedle.length >= 2 ? aiName.toLowerCase().includes(remixNeedle) : true

    if (!singleToken || !endsWithAnimal || !includesRemix) {
      const prefix = cleaned.slice(0, 3) || 'User'
      aiName = `${prefix.charAt(0).toUpperCase()}${prefix.slice(1).toLowerCase()}FunkyFox`
    }

    return new Response(
      JSON.stringify({ aiName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


