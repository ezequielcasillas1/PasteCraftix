import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { verifyAnthropicFallback } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const status = await verifyAnthropicFallback()
    return new Response(
      JSON.stringify({
        ok: status.configured && status.reachable,
        provider: 'anthropic',
        fallback: 'claude',
        ...status,
        checkedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: status.configured && status.reachable ? 200 : 503,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        provider: 'anthropic',
        fallback: 'claude',
        configured: !!(Deno.env.get('ANTHROPIC_API_KEY') || '').trim(),
        reachable: false,
        detail: (error as Error).message,
        checkedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 },
    )
  }
})
