/**
 * Regression coverage for text-only AI credits.
 * Run: node --test tests/ai-text-credits.test.mjs
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test, describe } from 'node:test';

import {
  _computeAiImageCreditsView,
  _computeAiTextCreditsView,
} from '../extension/popup/features/ai-lab/ai-lab.credits.js';
import {
  generateAIImageFromProfile,
  generateRandomAIImage,
} from '../extension/popup/features/profile/profile.ai-image.js';

async function importStrippedTs(path, { prepend = '', removeReExports = false } = {}) {
  let source = await readFile(path, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  if (removeReExports) {
    source = source.replace(/export\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?\n?/m, '');
  }
  const code = stripTypeScriptTypes(`${prepend}\n${source}`);
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);
}

const creditPacks = await importStrippedTs(
  new URL('../supabase/functions/_shared/credit_packs.ts', import.meta.url),
  { removeReExports: true },
);

const aiWorkflow = await importStrippedTs(
  new URL('../supabase/functions/_shared/ai_workflow.ts', import.meta.url),
  {
    prepend: `
      const createClient = () => { throw new Error('createClient should not be called in pure tests'); };
      async function requireNotBanned() { return null; }
      const computeTotalRemaining = ${creditPacks.computeTotalRemaining.toString()};
      const readPurchasedBalance = ${creditPacks.readPurchasedBalance.toString()};
      const hasSubscriptionAiAllowance = ${creditPacks.hasSubscriptionAiAllowance.toString()};
      const hasAiUsageEntitlement = ${creditPacks.hasAiUsageEntitlement.toString()};
      const planCreditDrain = ${creditPacks.planCreditDrain.toString()};
    `,
  },
);

function appContext() {
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

function createSupabaseMock({ updateResults, refetchRows = [] }) {
  const updates = [];
  const selects = [];

  class Query {
    constructor(kind = 'select') {
      this.kind = kind;
      this.filters = [];
    }

    update(payload) {
      this.kind = 'update';
      this.payload = payload;
      return this;
    }

    select(columns) {
      this.columns = columns;
      return this;
    }

    eq(column, value) {
      this.filters.push([column, value]);
      return this;
    }

    async maybeSingle() {
      if (this.kind === 'update') {
        updates.push({ payload: this.payload, filters: this.filters });
        return updateResults.shift() ?? { data: null, error: null };
      }
      selects.push({ columns: this.columns, filters: this.filters });
      return { data: refetchRows.shift() ?? null, error: null };
    }
  }

  return {
    updates,
    selects,
    from() {
      return new Query();
    },
  };
}

describe('client text-credit display', () => {
  test('image credits are always hidden after image generation removal', () => {
    const view = _computeAiImageCreditsView.call(appContext(), {
      ai_image_credits_limit: 100,
      ai_image_credits_used: 99,
    });

    assert.deepEqual(view, {
      state: 'hidden',
      text: '',
      css: 'is-muted',
      title: 'AI image generation has been removed',
    });
  });

  test('purchased credits grant access when subscription credits are not provisioned', () => {
    const view = _computeAiTextCreditsView.call(appContext(), {
      subscription_tier: 'free',
      subscription_status: 'active',
      has_unlimited_ai: false,
      ai_text_credits_limit: 0,
      ai_text_credits_used: 0,
      ai_purchased_credits_balance: 125,
    });

    assert.equal(view.state, 'ok');
    assert.equal(view.text, 'AI text credits: 125 purchased');
    assert.equal(view.css, '');
  });

  test('purchased credits are added to remaining subscription credits', () => {
    const view = _computeAiTextCreditsView.call(appContext(), {
      subscription_tier: 'premium',
      subscription_status: 'active',
      has_unlimited_ai: false,
      ai_text_credits_limit: 100,
      ai_text_credits_used: 80,
      ai_text_credits_reset_at: '2026-06-30T00:00:00Z',
      ai_purchased_credits_balance: 25,
    });

    assert.equal(view.state, 'ok');
    assert.equal(view.text, 'AI text credits: 45/100 (+25 purchased) • resets Jun 30');
    assert.equal(view.title, 'AI text credits remaining: 45 of 100 (25 purchased bonus) (resets Jun 30)');
  });
});

describe('removed profile image generation entry points', () => {
  test('profile generation shows upload guidance without calling backend refresh', async () => {
    const app = createToastApp();
    await generateAIImageFromProfile(app);

    assert.deepEqual(app.toasts, [{
      message: 'AI image generation has been removed. Upload your own image in Profile instead.',
      type: 'info',
    }]);
  });

  test('random generation shows upload guidance without creating image prompts', async () => {
    const app = createToastApp();
    await generateRandomAIImage(app);

    assert.deepEqual(app.toasts, [{
      message: 'AI image generation has been removed. Upload your own image in Profile instead.',
      type: 'info',
    }]);
  });
});

describe('server text-credit drain', () => {
  test('purchased credits alone allow text AI usage', () => {
    assert.equal(creditPacks.hasAiUsageEntitlement({
      subscription_tier: 'free',
      subscription_status: 'active',
      has_unlimited_ai: false,
      ai_purchased_credits_balance: 40,
    }), true);
  });

  test('planCreditDrain consumes subscription allowance before purchased credits', () => {
    assert.deepEqual(creditPacks.planCreditDrain(30, 50, 40), {
      subUsedDelta: 30,
      purchasedDelta: 10,
    });
    assert.equal(creditPacks.planCreditDrain(0, 10, 25), null);
  });

  test('decrementTextCredits drains purchased credits after subscription credits are exhausted', async () => {
    const supabase = createSupabaseMock({
      updateResults: [{
        data: {
          ai_text_credits_used: 100,
          ai_text_credits_limit: 100,
          ai_text_credits_reset_at: '2026-06-30T00:00:00Z',
          ai_purchased_credits_balance: 25,
        },
        error: null,
      }],
    });

    const result = await aiWorkflow.decrementTextCredits({
      userId: 'user-1',
      supabase,
      unlimited: false,
      creditsUsed: 100,
      creditsLimit: 100,
      purchasedBalance: 50,
      resetAtIso: '2026-06-30T00:00:00Z',
    }, 25);

    assert.equal(result.creditsRemaining, 25);
    assert.equal(result.purchasedBalance, 25);
    assert.deepEqual(supabase.updates[0].payload, {
      ai_text_credits_used: 100,
      ai_text_credits_limit: 100,
      ai_text_credits_reset_at: '2026-06-30T00:00:00Z',
      ai_purchased_credits_balance: 25,
      updated_at: supabase.updates[0].payload.updated_at,
    });
  });

  test('decrementTextCredits recomputes drain plan after compare-and-set retry', async () => {
    const supabase = createSupabaseMock({
      updateResults: [
        { data: null, error: null },
        {
          data: {
            ai_text_credits_used: 100,
            ai_text_credits_limit: 100,
            ai_text_credits_reset_at: '2026-06-30T00:00:00Z',
            ai_purchased_credits_balance: 20,
          },
          error: null,
        },
      ],
      refetchRows: [{
        ai_text_credits_used: 50,
        ai_text_credits_limit: 100,
        ai_text_credits_reset_at: '2026-06-30T00:00:00Z',
        ai_purchased_credits_balance: 50,
      }],
    });

    const result = await aiWorkflow.decrementTextCredits({
      userId: 'user-1',
      supabase,
      unlimited: false,
      creditsUsed: 0,
      creditsLimit: 100,
      purchasedBalance: 50,
      resetAtIso: '2026-06-30T00:00:00Z',
    }, 80);

    assert.equal(supabase.updates.length, 2);
    assert.deepEqual(supabase.updates[1].payload, {
      ai_text_credits_used: 100,
      ai_text_credits_limit: 100,
      ai_text_credits_reset_at: '2026-06-30T00:00:00Z',
      ai_purchased_credits_balance: 20,
      updated_at: supabase.updates[1].payload.updated_at,
    });
    assert.deepEqual(supabase.updates[1].filters, [
      ['user_id', 'user-1'],
      ['ai_text_credits_used', 50],
      ['ai_purchased_credits_balance', 50],
    ]);
    assert.equal(result.creditsRemaining, 20);
    assert.equal(result.purchasedBalance, 20);
  });
});
