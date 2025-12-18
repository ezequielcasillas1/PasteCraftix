import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { text, level } = await req.json()

    if (!text) {
      throw new Error('Text is required')
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const systemPrompt = levelPrompts[level] || levelPrompts['college']

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please explain this text:\n\n${text}` }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'OpenAI API error')
    }

    const data = await response.json()
    const breakdown = data.choices[0].message.content.trim()

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


