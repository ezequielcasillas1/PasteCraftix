import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let audience = 'all';
    try {
      const body = await req.json();
      audience = String(body?.audience || 'all').toLowerCase();
    } catch (_) {
      // GET or empty body — default audience
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('app_announcements')
      .select('id, title, body, link_url, link_label, audience, priority, active_from, active_until')
      .lte('active_from', now)
      .or(`active_until.is.null,active_until.gt.${now}`)
      .order('priority', { ascending: false })
      .order('active_from', { ascending: false })
      .limit(5);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const filtered = rows.filter((row) => {
      const rowAudience = String(row.audience || 'all').toLowerCase();
      if (rowAudience === 'all') return true;
      if (audience === 'all') return true;
      return rowAudience === audience;
    });

    return new Response(JSON.stringify({ announcements: filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[get-announcements]', error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || String(error), announcements: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
