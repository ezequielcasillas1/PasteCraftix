import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt, type, animalType, imageBase64 } = await req.json()

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    let finalPrompt: string

    if (type === 'animal' && animalType) {
      // Animal avatar generation
      const animalTraits: Record<string, string> = {
        'Rabbit': 'cute, fluffy, energetic, with long ears',
        'Tiger': 'fierce, powerful, majestic, with bold stripes',
        'Dragon': 'mythical, wise, powerful, with scales and wings',
        'Fox': 'clever, sly, elegant, with a fluffy tail',
        'Wolf': 'loyal, fierce, pack leader, with piercing eyes',
        'Bear': 'strong, protective, cuddly yet powerful',
        'Panda': 'peaceful, zen, adorable, black and white',
        'Lion': 'regal, brave, king of the jungle, with majestic mane',
        'Eagle': 'soaring, free, sharp-eyed, patriotic',
        'Phoenix': 'mythical, reborn from fire, radiant, immortal',
        'Owl': 'wise, nocturnal, mysterious, with big eyes',
        'Cat': 'independent, graceful, mysterious, with whiskers',
        'Dog': 'loyal, friendly, playful, mans best friend'
      }
      const trait = animalTraits[animalType] || 'cool, funky, energetic'
      finalPrompt = `Create a single ultra-funky cartoon ${animalType} character avatar. The ${animalType} is ${trait}. Style: vibrant neon colors (pink, cyan, yellow, purple), bold thick black outlines, modern animated/anime style, playful and full of energy. The ${animalType} is anthropomorphic - standing upright on two legs, wearing cool streetwear or accessories, expressive face with personality. Background: simple gradient or solid color. Composition: portrait style, centered, showing character from chest up. Make it colorful, fun, and bursting with character! Show ONLY ONE ${animalType}, no other animals or people.`
    } else if (type === 'cartoon' && imageBase64) {
      // Analyze uploaded photo first
      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this person\'s appearance in detail for creating a cartoon avatar. Include: hair color/style, skin tone, facial features, any distinctive characteristics. Be specific but brief (2-3 sentences).'
                },
                {
                  type: 'image_url',
                  image_url: { url: imageBase64 }
                }
              ]
            }
          ],
          max_tokens: 200
        })
      })

      if (!visionResponse.ok) {
        throw new Error('Failed to analyze image')
      }

      const visionData = await visionResponse.json()
      const personDescription = visionData.choices[0].message.content

      finalPrompt = `Create a single funky cartoon avatar portrait of this person: ${personDescription}. Style: vibrant colors, bold black outlines, modern cartoon/animated character style, playful and fun. Show ONLY ONE person, centered, portrait orientation. Make it colorful and energetic while keeping their recognizable features.`
    } else if (prompt) {
      finalPrompt = prompt
    } else {
      throw new Error('Invalid request: provide prompt, animal type, or image')
    }

    // Generate image with DALL-E 3
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DALL-E API error')
    }

    const data = await response.json()
    const imageUrl = data.data[0].url

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


