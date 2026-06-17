/** Vertical slice: ai-functions.js */
const AI_TEXT_INPUT_MAX_CHARS = 12000;
export const aiFunctionsMixin = {
_buildCategorizeClipPayload(clips, textLimit = 200) {
  return (Array.isArray(clips) ? clips : []).map((c) => {
    const meta = c && typeof c.meta === 'object' ? c.meta : {};
    const text = String(c?.text || '').slice(0, textLimit);
    const sourcePageUrl = String(meta.sourcePageUrl || meta.url || c?.sourcePageUrl || c?.url || '').slice(0, 400);
    let sourceHost = '';
    let sourceTopic = '';
    if (sourcePageUrl) {
      try {
        const u = new URL(sourcePageUrl);
        sourceHost = String(u.hostname || '').toLowerCase();
        const pathParts = String(u.pathname || '')
          .split('/')
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        sourceTopic = pathParts.join(' ').slice(0, 120);
      } catch (_) {}
    }
    return { text, sourcePageUrl, sourceHost, sourceTopic };
  });
},

_truncateAiInputText(value, maxChars = AI_TEXT_INPUT_MAX_CHARS) {
  return String(value ?? '').slice(0, maxChars);
},

// OpenAI Integration Methods
async generateAIName(userName) {
  try {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    const { data: { session } } = await this.client.auth.getSession();
    const accessToken = session?.access_token || '';
    if (!accessToken) {
      throw new Error('Please sign in to generate an AI name.');
    }

    const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
    const candidates = [`${baseUrl}/ai-name`, `${baseUrl}/generate-ai-name`];
    const body = await this._withAiWorkflow({ userName });
    const tryNextEndpointStatuses = new Set([404, 502, 503]);

    let response = null;
    for (let i = 0; i < candidates.length; i++) {
      const url = candidates[i];
      response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(body)
      }, 30000, 'AI name generation timed out');

      const isLast = i === candidates.length - 1;
      if (tryNextEndpointStatuses.has(response.status) && !isLast) continue;
      break;
    }
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const detail = errorBody.error || errorBody.message || errorBody.msg;
      throw new Error(detail || `AI name generation failed (${response.status})`);
    }
    
    const data = await response.json();
    console.log('✅ Generated AI name:', data.aiName, data.cycleComplete ? '(cycle complete)' : '');
    return data;
    
  } catch (error) {
    console.error('Failed to generate AI name:', error);
    return { error: error?.message || 'AI name generation failed' };
  }
},

async analyzePhotoWithVision(imageBase64) {
  try {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    const { data: { session } } = await this.client.auth.getSession();
    const accessToken = session?.access_token || '';
    if (!accessToken) {
      throw new Error('Please sign in to use Vision.');
    }

    const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-vision`;
    const body = await this._withAiWorkflow({ imageBase64 });
    const response = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    }, 30000, 'Vision analysis timed out');

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || response.statusText || 'Vision analysis failed');
    }

    const data = await response.json();
    const description = data?.description || '';
    return description;

  } catch (error) {
    console.error('Failed to analyze photo:', error);
    throw error;
  }
},

// ─── AI Smart Categorization (Magic Wand) ───
async aiCategorize(clips) {
  try {
    if (!Array.isArray(clips) || clips.length === 0) return [];

    // Get access token for premium gating
    let accessToken = '';
    try {
      const s = await this.client?.auth?.getSession?.();
      accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {}

    const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-categorize`;
    const body = { clips: this._buildCategorizeClipPayload(clips, 200) };

    const response = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
          ? `Bearer ${accessToken}`
          : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
      },
      body: JSON.stringify(body)
    }, 20000, 'AI categorization timed out');

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'AI categorization failed');
    }

    const data = await response.json();
    return Array.isArray(data.categories) ? data.categories : [];
  } catch (error) {
    console.error('AI categorize failed:', error);
    return [];
  }
},

async aiCategorizeSuggestions(clips) {
  try {
    if (!Array.isArray(clips) || clips.length === 0) {
      return [];
    }

    let accessToken = '';
    try {
      const s = await this.client?.auth?.getSession?.();
      accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {}

    const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-categorize`;
    const body = {
      mode: 'suggestions',
      clips: this._buildCategorizeClipPayload(clips, 200),
    };

    const response = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
          ? `Bearer ${accessToken}`
          : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
      },
      body: JSON.stringify(body)
    }, 20000, 'AI category suggestions timed out');

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'AI category suggestions failed');
    }

    const data = await response.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch (error) {
    console.error('AI categorize suggestions failed:', error);
    return [];
  }
},

// ─── AI Smart Format (Magic Wand) ───
async aiFormat(clips) {
  try {
    if (!Array.isArray(clips) || clips.length === 0) return [];

    let accessToken = '';
    try {
      const s = await this.client?.auth?.getSession?.();
      accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {}

    const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-format`;
    const body = { clips: clips.map(c => ({ text: String(c.text || '').slice(0, 500) })) };

    const response = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
          ? `Bearer ${accessToken}`
          : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
      },
      body: JSON.stringify(body)
    }, 25000, 'AI format timed out');

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'AI format failed');
    }

    const data = await response.json();
    return Array.isArray(data.formatted) ? data.formatted : [];
  } catch (error) {
    console.error('AI format failed:', error);
    return [];
  }
},

// ─── AI Refactoring (Craft Clips) ───
async aiRefactor(clips, level = 'college') {
  try {
    if (!Array.isArray(clips) || clips.length === 0) {
      return { refactored: [], diagnostics: [] };
    }

    let accessToken = '';
    try {
      const s = await this.client?.auth?.getSession?.();
      accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {}

    const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-refactor`;
    const body = {
      level: String(level || 'college'),
      clips: clips.map(c => ({ text: String(c.text || '').slice(0, 500) })),
    };

    const response = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
          ? `Bearer ${accessToken}`
          : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`,
      },
      body: JSON.stringify(body),
    }, 30000, 'AI refactor timed out');

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'AI refactor failed');
    }

    const data = await response.json();
    return {
      refactored: Array.isArray(data.refactored) ? data.refactored : [],
      diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
    };
  } catch (error) {
    console.error('AI refactor failed:', error);
    return { refactored: [], diagnostics: [] };
  }
},

async submitRefactorTicket(ticket) {
  if (!this.client) throw new Error('Not connected');
  const userId = await this.getSyncUserId();
  if (!userId) throw new Error('Sign in to report a ticket');

  const row = {
    user_id: userId,
    history_id: ticket.historyId != null ? Number(ticket.historyId) : null,
    user_message: String(ticket.message || '').trim().slice(0, 2000),
    before_text: String(ticket.beforeText || '').slice(0, 4000),
    after_text: String(ticket.afterText || '').slice(0, 4000),
    refactor_level: String(ticket.refactorLevel || '').slice(0, 64),
    synthesis: ticket.synthesis && typeof ticket.synthesis === 'object' ? ticket.synthesis : {},
  };

  const { data, error } = await this.client
    .from('refactor_tickets')
    .insert(row)
    .select('id')
    .single();

  if (error) throw new Error(error.message || 'Failed to submit ticket');
  return data;
},

async breakdownText(text, level = 'child') {
  try {
    console.log(`🧠 Breaking down text at ${level} level...`);

    const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
    const candidates = [`${baseUrl}/ai-breakdown`, `${baseUrl}/explain-at-level`];
    const body = await this._withAiWorkflow({ text: this._truncateAiInputText(text), level });

    let accessToken = '';
    try {
      const s = await this.client?.auth?.getSession?.();
      accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {}

    let response = null;
    for (const url of candidates) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken
            ? `Bearer ${accessToken}`
            : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify(body)
      });

      // Back-compat: some deployments use a different function name
      if (response.status !== 404) break;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Breakdown failed');
    }

    const data = await response.json();
    console.log('✅ Text breakdown complete');
    return data.breakdown;

  } catch (error) {
    console.error('Failed to breakdown text:', error);
    throw error;
  }
},

async generateSummaryQuestions(text) {
  try {
    console.log('🤔 Generating summary questions...');

    const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
    const candidates = [`${baseUrl}/ai-summary`, `${baseUrl}/summarize-or-qa`];
    const body = await this._withAiWorkflow({
      text: this._truncateAiInputText(text),
      generateQuestions: true,
    });

    let accessToken = '';
    try {
      const s = await this.client?.auth?.getSession?.();
      accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {}

    let response = null;
    for (const url of candidates) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken
            ? `Bearer ${accessToken}`
            : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify(body)
      });

      // Back-compat: some deployments use a different function name
      if (response.status !== 404) break;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate questions');
    }

    const data = await response.json();
    console.log('✅ Generated', data.questions.length, 'questions');
    return data.questions;

  } catch (error) {
    console.error('Failed to generate questions:', error);
    throw error;
  }
},

async generateSummary(text, question) {
  try {
    console.log('📝 Generating summary for question:', question);

    const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
    const candidates = [`${baseUrl}/ai-summary`, `${baseUrl}/summarize-or-qa`];
    const body = await this._withAiWorkflow({
      text: this._truncateAiInputText(text),
      question: this._truncateAiInputText(question),
    });

    let accessToken = '';
    try {
      const s = await this.client?.auth?.getSession?.();
      accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {}

    let response = null;
    for (const url of candidates) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken
            ? `Bearer ${accessToken}`
            : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify(body)
      });

      // Back-compat: some deployments use a different function name
      if (response.status !== 404) break;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate summary');
    }

    const data = await response.json();
    console.log('✅ Summary generated');
    return data.summary;

  } catch (error) {
    console.error('Failed to generate summary:', error);
    throw error;
  }
},

async generateProfileImage(description, userImageBase64 = null, aiGeneratedName = null) {
  void description;
  void userImageBase64;
  void aiGeneratedName;
  throw new Error('AI image generation has been removed. Upload your own image instead.');
}

// =====================================================
};
