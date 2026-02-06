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
    const { text, question, generateQuestions } = body || {}

    if (!text) {
      throw new Error('Text is required')
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    let systemPrompt: string
    let userPrompt: string

    if (generateQuestions) {
      // Generate suggested questions
      systemPrompt = 'You are a helpful assistant. Generate 4 short, insightful questions about the provided text. Return ONLY the questions, one per line, no numbering or bullets.'
      userPrompt = `Generate 4 questions about this text:\n\n${text}`
    } else if (question) {
      // Answer a specific question
      systemPrompt = 'You are a helpful assistant. Answer the question based on the provided text. Be concise but thorough.'
      userPrompt = `Text: ${text}\n\nQuestion: ${question}`
    } else {
      // General summary
      systemPrompt = 'You are a helpful assistant. Provide a clear, concise summary of the text.'
      userPrompt = `Summarize this text:\n\n${text}`
    }

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }

    const { data } = await fetchChatCompletionsWithModelFallback(openaiKey, payload, models.chatTextModel)
    const result = String(data?.choices?.[0]?.message?.content || '').trim()

    if (generateQuestions) {
      const questions = result.split('\n').filter((q: string) => q.trim()).slice(0, 4)
      return new Response(
        JSON.stringify({ questions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ summary: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


