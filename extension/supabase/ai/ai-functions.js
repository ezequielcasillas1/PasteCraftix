/** Vertical slice: ai-functions.js — Edge Function callers (URL + anon/JWT only). */
const AI_TEXT_INPUT_MAX_CHARS = 12000;

function _throwAiEdgeError(errorBody, fallback) {
  const body = errorBody && typeof errorBody === 'object' ? errorBody : {};
  const detail = String(body.error || body.message || body.msg || '').trim();
  const providerBody = String(body.providerBody || '').trim();
  const combined = [detail || fallback, providerBody].filter(Boolean).join(' — ');
  const err = new Error(combined || fallback);
  if (body.code) err.aiErrorCode = body.code;
  if (body.providerStatus != null) err.providerStatus = body.providerStatus;
  if (providerBody) err.providerBody = providerBody;
  throw err;
}

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

  _withOptionalImageBase64(payload, imageBase64) {
    const next = payload && typeof payload === 'object' ? { ...payload } : {};
    const image = typeof imageBase64 === 'string' ? imageBase64.trim() : '';
    if (image) next.imageBase64 = image;
    return next;
  },

  async generateAIName(userName) {
    try {
      if (!this.client) {
        throw new Error('Supabase not initialized');
      }
      const accessToken = await this._getAiAccessToken();
      if (!accessToken) {
        throw new Error('Please sign in to generate an AI name.');
      }

      const body = await this._withAiWorkflow({ userName });
      const response = await this._invokeAiEdge(
        ['ai-name', 'generate-ai-name'],
        body,
        {
          timeoutMs: 30000,
          timeoutMessage: 'AI name generation timed out',
          requireAuth: true,
          allowAnon: false,
          tryNextStatuses: new Set([404, 502, 503]),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        _throwAiEdgeError(errorBody, `AI name generation failed (${response.status})`);
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
      const accessToken = await this._getAiAccessToken();
      if (!accessToken) {
        throw new Error('Please sign in to use Vision.');
      }

      const body = await this._withAiWorkflow({ imageBase64 });
      const response = await this._invokeAiEdge('ai-vision', body, {
        timeoutMs: 30000,
        timeoutMessage: 'Vision analysis timed out',
        requireAuth: true,
        allowAnon: false,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        _throwAiEdgeError(errorData, response.statusText || 'Vision analysis failed');
      }

      const data = await response.json();
      return data?.description || '';
    } catch (error) {
      console.error('Failed to analyze photo:', error);
      throw error;
    }
  },

  async aiCategorize(clips) {
    try {
      if (!Array.isArray(clips) || clips.length === 0) return [];

      const body = await this._withAiWorkflow({
        clips: this._buildCategorizeClipPayload(clips, 200),
      });
      const response = await this._invokeAiEdge('ai-categorize', body, {
        timeoutMs: 20000,
        timeoutMessage: 'AI categorization timed out',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        _throwAiEdgeError(error, 'AI categorization failed');
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

      const body = await this._withAiWorkflow({
        mode: 'suggestions',
        clips: this._buildCategorizeClipPayload(clips, 200),
      });
      const response = await this._invokeAiEdge('ai-categorize', body, {
        timeoutMs: 20000,
        timeoutMessage: 'AI category suggestions timed out',
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        _throwAiEdgeError(errorBody, 'AI category suggestions failed');
      }

      const data = await response.json();
      return Array.isArray(data.suggestions) ? data.suggestions : [];
    } catch (error) {
      console.error('AI categorize suggestions failed:', error);
      return [];
    }
  },

  async aiFormat(clips) {
    try {
      if (!Array.isArray(clips) || clips.length === 0) return [];

      const body = await this._withAiWorkflow({
        clips: clips.map(c => ({ text: String(c.text || '').slice(0, 8000) })),
      });
      const response = await this._invokeAiEdge('ai-format', body, {
        timeoutMs: 30000,
        timeoutMessage: 'AI format timed out',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        _throwAiEdgeError(error, 'AI format failed');
      }

      const data = await response.json();
      return Array.isArray(data.formatted) ? data.formatted : [];
    } catch (error) {
      console.error('AI format failed:', error);
      // Re-throw so AI Lab can show model-not-capable / real failures (no silent []).
      throw error;
    }
  },

  async aiRefactor(clips, level = 'college') {
    try {
      if (!Array.isArray(clips) || clips.length === 0) {
        return { refactored: [], diagnostics: [] };
      }

      const body = await this._withAiWorkflow({
        level: String(level || 'college'),
        clips: clips.map(c => ({ text: String(c.text || '').slice(0, 8000) })),
      });
      const response = await this._invokeAiEdge('ai-refactor', body, {
        timeoutMs: 30000,
        timeoutMessage: 'AI refactor timed out',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = error.error || error.message || 'AI refactor failed';
        if (response.status === 402 || /no text credits/i.test(String(detail))) {
          throw new Error('Need more AI credits');
        }
        _throwAiEdgeError(error, 'AI refactor failed');
      }

      const data = await response.json();
      const refactored = Array.isArray(data.refactored) ? data.refactored : [];
      const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
      const diagSummary = diagnostics.slice(0, 3).map((d, i) => ({
        index: d?.index ?? i,
        outcome: d?.outcome,
        originalLen: d?.originalLen,
        refactoredLen: d?.refactoredLen,
        synthesis: d?.synthesis ? String(d.synthesis).slice(0, 120) : undefined,
      }));
      console.warn('[PasteCraft:refactor]', {
        message: 'aiRefactor response',
        clipCount: clips.length,
        resultCount: refactored.length,
        diagnosticCount: diagnostics.length,
        diagnostics: diagSummary,
      });
      return { refactored, diagnostics };
    } catch (error) {
      console.warn('[PasteCraft:refactor]', {
        message: 'aiRefactor request failed',
        clipCount: Array.isArray(clips) ? clips.length : 0,
        error: error?.message || String(error),
      });
      throw error;
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

      const body = await this._withAiWorkflow({ text: this._truncateAiInputText(text), level });
      const response = await this._invokeAiEdge(
        ['ai-breakdown', 'explain-at-level'],
        body,
        { timeoutMs: 30000, timeoutMessage: 'Breakdown timed out', tryNextStatuses: new Set([404]) }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        _throwAiEdgeError(error, 'Breakdown failed');
      }

      const data = await response.json();
      console.log('✅ Text breakdown complete');
      return data.breakdown;
    } catch (error) {
      console.error('Failed to breakdown text:', error);
      throw error;
    }
  },

  async generateSummaryQuestions(text, imageBase64 = null) {
    try {
      console.log('🤔 Generating summary questions...');

      const body = await this._withAiWorkflow(this._withOptionalImageBase64({
        text: this._truncateAiInputText(text),
        generateQuestions: true,
      }, imageBase64));

      const response = await this._invokeAiEdge(
        ['ai-summary', 'summarize-or-qa'],
        body,
        { timeoutMs: 30000, timeoutMessage: 'Summary questions timed out', tryNextStatuses: new Set([404]) }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        _throwAiEdgeError(error, 'Failed to generate questions');
      }

      const data = await response.json();
      console.log('✅ Generated', data.questions.length, 'questions');
      return data.questions;
    } catch (error) {
      console.error('Failed to generate questions:', error);
      throw error;
    }
  },

  async generateSummary(text, question, imageBase64 = null) {
    try {
      console.log('📝 Generating summary for question:', question);

      const body = await this._withAiWorkflow(this._withOptionalImageBase64({
        text: this._truncateAiInputText(text),
        question: this._truncateAiInputText(question),
      }, imageBase64));
      const response = await this._invokeAiEdge(
        ['ai-summary', 'summarize-or-qa'],
        body,
        { timeoutMs: 30000, timeoutMessage: 'Summary timed out', tryNextStatuses: new Set([404]) }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        _throwAiEdgeError(error, 'Failed to generate summary');
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
  },
};
