/**
 * Regression tests for text-only AI credits and removed AI image generation.
 * Run: node --test tests/ai-text-credits-removal.test.mjs
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  _computeAiImageCreditsView,
  _computeAiTextCreditsView,
} from '../extension/popup/features/ai-lab/ai-lab.credits.js';
import {
  createCustomCreditCheckout,
} from '../extension/popup/features/billing/billing.service.js';
import {
  generateAIImageFromProfile,
  generateRandomAIImage,
} from '../extension/popup/features/profile/profile.ai-image.js';
import {
  generateAnimalAvatar,
  generateMyCartoon,
} from '../extension/popup/features/profile/profile.generators.js';
import { aiFunctionsMixin } from '../extension/supabase/ai-functions.js';

function createCreditsContext() {
  return {
    _formatShortDate(value) {
      return value ? 'Jun 30' : '';
    },
  };
}

function createToastApp() {
  const toasts = [];
  return {
    toasts,
    showToast(message, type) {
      toasts.push({ message, type });
    },
  };
}

describe('AI text credits view', () => {
  test('image credits are hidden after AI image generation removal', () => {
    assert.deepEqual(_computeAiImageCreditsView({}), {
      state: 'hidden',
      text: '',
      css: 'is-muted',
      title: 'AI image generation has been removed',
    });
  });

  test('premium text credits include subscription remaining plus purchased balance', () => {
    const view = _computeAiTextCreditsView.call(createCreditsContext(), {
      subscription_tier: 'premium',
      subscription_status: 'active',
      ai_text_credits_limit: 4000,
      ai_text_credits_used: 500,
      ai_text_credits_reset_at: '2026-06-30T00:00:00.000Z',
      ai_purchased_credits_balance: 125,
    });

    assert.equal(view.state, 'ok');
    assert.equal(view.text, 'AI text credits: 3625/4000 (+125 purchased) \u2022 resets Jun 30');
    assert.equal(view.css, '');
    assert.match(view.title, /3625 of 4000/);
    assert.match(view.title, /125 purchased bonus/);
  });

  test('purchased balance grants text credit access without premium subscription allowance', () => {
    const view = _computeAiTextCreditsView.call(createCreditsContext(), {
      subscription_tier: 'free',
      subscription_status: 'active',
      ai_text_credits_limit: null,
      ai_text_credits_used: 0,
      ai_purchased_credits_balance: 250,
    });

    assert.equal(view.state, 'ok');
    assert.equal(view.text, 'AI text credits: 250 purchased');
    assert.equal(view.css, '');
    assert.equal(view.title, '250 purchased text credits available for AI text');
  });

  test('basic tier without purchased balance has no AI text access', () => {
    const view = _computeAiTextCreditsView.call(createCreditsContext(), {
      subscription_tier: 'basic',
      subscription_status: 'active',
      ai_text_credits_limit: 0,
      ai_text_credits_used: 0,
      ai_purchased_credits_balance: 0,
    });

    assert.equal(view.state, 'no_access');
    assert.equal(view.text, 'AI text credits: 0');
    assert.equal(view.css, 'is-empty');
  });
});

describe('AI image generation removal', () => {
  test('client Supabase image generation entry point rejects before any network call', async () => {
    await assert.rejects(
      () => aiFunctionsMixin.generateProfileImage.call({}, 'profile prompt'),
      /AI image generation has been removed/,
    );
  });

  test('profile image generation buttons show upload guidance only', async () => {
    const app = createToastApp();

    await generateAIImageFromProfile(app);
    await generateRandomAIImage(app);
    await generateAnimalAvatar(app);
    await generateMyCartoon(app);

    assert.equal(app.toasts.length, 4);
    for (const toast of app.toasts) {
      assert.equal(toast.type, 'info');
      assert.match(toast.message, /Image generation has been removed|AI image generation has been removed/);
      assert.match(toast.message, /Upload/);
    }
  });
});

describe('custom text credit checkout', () => {
  test('rejects sub-minimum text credit purchases before sending checkout message', async () => {
    const priorChrome = globalThis.chrome;
    const priorConfig = globalThis.PASTECRAFT_CONFIG;
    const priorSupabase = globalThis.pasteCraftSupabase;
    const app = createToastApp();
    app.currentUser = { id: 'user-1' };
    let sentMessage = null;

    globalThis.chrome = {
      runtime: {
        sendMessage(payload, callback) {
          sentMessage = payload;
          callback({ success: true });
        },
      },
    };
    globalThis.PASTECRAFT_CONFIG = {
      supabase: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    };
    globalThis.pasteCraftSupabase = {
      client: { auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } },
    };

    try {
      await createCustomCreditCheckout(app, 99);
      assert.equal(sentMessage, null);
      assert.deepEqual(app.toasts.at(-1), {
        message: 'Enter 100\u2013100,000 text credits',
        type: 'info',
      });
    } finally {
      globalThis.chrome = priorChrome;
      globalThis.PASTECRAFT_CONFIG = priorConfig;
      globalThis.pasteCraftSupabase = priorSupabase;
    }
  });

  test('valid custom text credit purchases send payment-mode checkout payload', async () => {
    const priorChrome = globalThis.chrome;
    const priorConfig = globalThis.PASTECRAFT_CONFIG;
    const priorSupabase = globalThis.pasteCraftSupabase;
    const app = createToastApp();
    app.currentUser = { id: 'user-1' };
    let sentMessage = null;

    globalThis.chrome = {
      runtime: {
        sendMessage(payload, callback) {
          sentMessage = payload;
          callback({ success: true });
        },
      },
    };
    globalThis.PASTECRAFT_CONFIG = {
      supabase: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    };
    globalThis.pasteCraftSupabase = {
      client: { auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) } },
    };

    try {
      await createCustomCreditCheckout(app, 100);
      assert.equal(sentMessage.action, 'pcCreateCheckout');
      assert.equal(sentMessage.mode, 'payment');
      assert.equal(sentMessage.creditAmount, 100);
      assert.equal(sentMessage.credit_amount, 100);
      assert.equal(sentMessage.credits, 100);
      assert.equal(sentMessage.accessToken, 'jwt');
      assert.equal(sentMessage.supabaseUrl, 'https://example.supabase.co');
      assert.equal(sentMessage.anonKey, 'anon-key');
      assert.equal(sentMessage.priceId, undefined);
    } finally {
      globalThis.chrome = priorChrome;
      globalThis.PASTECRAFT_CONFIG = priorConfig;
      globalThis.pasteCraftSupabase = priorSupabase;
    }
  });
});
