/** Vertical slice: ai-functions.js */
import { extractAnimalSuffix } from '../shared/animal-names.js';
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

    let response = null;
    for (const url of candidates) {
      response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(body)
      }, 30000, 'AI name generation timed out');

      // Back-compat: some deployments use a different function name
      if (response.status !== 404) break;
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI name generation failed');
    }
    
    const data = await response.json();
    console.log('✅ Generated AI name:', data.aiName, data.cycleComplete ? '(cycle complete)' : '');
    return data;
    
  } catch (error) {
    console.error('Failed to generate AI name:', error);
    return null;
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
    const body = await this._withAiWorkflow({ text, level });

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
    const body = await this._withAiWorkflow({ text: text.substring(0, 3000), generateQuestions: true });

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
    const body = await this._withAiWorkflow({ text, question });

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
  try {
    let requestBody = {};

    
    const animalType = aiGeneratedName ? extractAnimalSuffix(aiGeneratedName) : null;

    // Check if this is an animal avatar request (explicit 'animal' flag OR just aiGeneratedName with animal)
    if ((userImageBase64 === 'animal' && aiGeneratedName) || (!userImageBase64 && animalType)) {
      console.log(`🐾 Creating ${animalType} avatar from AI name...`);
      requestBody = { type: 'animal', animalType };
    }
    // If user uploaded a photo, create cartoon from it
    else if (userImageBase64 && userImageBase64 !== 'animal') {
      console.log('📸 Creating cartoon from uploaded photo...');
      requestBody = { type: 'cartoon', imageBase64: userImageBase64 };
    }
    // Fallback to generic prompt
    else if (description) {
      console.log('🎨 Creating image from description...');
      requestBody = { prompt: `Create a single premium 3D stylized cartoon avatar portrait. Art style: polished animated movie still with soft studio lighting, smooth textures, vibrant synthwave neons. NOT flat vector art, NOT thick black outlines. Show only ONE person, centered, bust portrait. Theme: ${description}` };
    } else {
      throw new Error('No valid input provided for image generation. Please provide a description, photo, or AI name with animal.');
    }

    requestBody = await this._withAiWorkflow(requestBody);

    const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
    const candidates = [`${baseUrl}/ai-image`, `${baseUrl}/avatar-generator`];

    try {
      const sessionResult = await this.client?.auth?.getSession?.();
      const userId = sessionResult?.data?.session?.user?.id
        ? String(sessionResult.data.session.user.id)
        : '';
      if (userId) {
        const sub = await this.getUserSubscription(userId);
        if (!sub) {
          const email = sessionResult?.data?.session?.user?.email
            ? String(sessionResult.data.session.user.email)
            : '';
          await this.createUserSubscription(userId, email, 'free');
        }
      }
    } catch (_) {}

    let response = null;
    for (const url of candidates) {
      // Use the authenticated user's JWT if available (server-side credit enforcement depends on it).
      let accessToken = '';
      try {
        const s = await this.client?.auth?.getSession?.();
        accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
      } catch (_) {}

      response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': `${PASTECRAFT_CONFIG.supabase.anonKey}`,
          'Authorization': accessToken
            ? `Bearer ${accessToken}`
            : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify(requestBody)
      }, 90000, 'Image generation timed out');

      // Back-compat: some deployments use a different function name
      if (response.status !== 404) break;
    }


    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Image generation failed');
    }

    const data = await response.json();
    const temporaryImageUrl = data.imageUrl;
    console.log('✅ Image generated! Converting to permanent URL...');

    // Convert temporary URL to permanent Supabase Storage URL
    const userId = await this.getSyncUserId();
    const permanentImageUrl = await this.downloadAndUploadImage(temporaryImageUrl, userId);
    
    return {
      imageUrl: permanentImageUrl,
      creditsRemaining: typeof data.creditsRemaining === 'number' ? data.creditsRemaining : null,
      creditsResetAt: data.creditsResetAt || null,
      creditsLimit: typeof data.creditsLimit === 'number' ? data.creditsLimit : null,
    };

  } catch (error) {
    const msg = String(error?.message || error || '');
    if (msg.includes('does not exist') || msg.includes('no such model') || msg.includes('model')) {
      const wrapped = new Error('Image generation model unavailable. Please try again later.');
      wrapped.cause = error;
      console.error('Failed to generate profile image:', wrapped);
      throw wrapped;
    }
    console.error('Failed to generate profile image:', error);
    throw error;
  }
}

// =====================================================
};
