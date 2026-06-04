/**
 * Regression tests for popup checkout dispatch.
 * Run: node --test tests/billing-checkout.test.mjs
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  createCheckout,
  createCustomCreditCheckout,
} from '../extension/popup/features/billing/billing.service.js';

const priorAlert = globalThis.alert;
const priorChrome = globalThis.chrome;
const priorConfig = globalThis.PASTECRAFT_CONFIG;
const priorPasteCraftSupabase = globalThis.pasteCraftSupabase;

let sentMessages;

function createApp(overrides = {}) {
  const toasts = [];
  return {
    currentUser: { id: 'user-1' },
    toasts,
    showToast(message, type) {
      toasts.push({ message, type });
    },
    ...overrides,
  };
}

function installCheckoutHarness(config = {}) {
  sentMessages = [];
  globalThis.alert = (message) => {
    throw new Error(`Unexpected alert: ${message}`);
  };
  globalThis.PASTECRAFT_CONFIG = {
    supabase: {
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
      ...config,
    },
  };
  globalThis.pasteCraftSupabase = {
    client: {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
        }),
      },
    },
  };
  globalThis.chrome = {
    runtime: {
      sendMessage(message, callback) {
        sentMessages.push(message);
        callback({ success: true });
      },
    },
  };
}

beforeEach(() => {
  installCheckoutHarness();
});

afterEach(() => {
  globalThis.alert = priorAlert;
  globalThis.chrome = priorChrome;
  globalThis.PASTECRAFT_CONFIG = priorConfig;
  globalThis.pasteCraftSupabase = priorPasteCraftSupabase;
  sentMessages = [];
});

describe('billing checkout dispatch', () => {
  test('blocks custom credit checkout for signed-out users', async () => {
    const app = createApp({ currentUser: null });

    await createCustomCreditCheckout(app, 100);

    assert.deepEqual(sentMessages, []);
    assert.deepEqual(app.toasts, [
      { message: 'Please sign in to buy credits', type: 'info' },
    ]);
  });

  test('blocks custom credit checkout below Stripe minimum', async () => {
    const app = createApp();

    await createCustomCreditCheckout(app, 25);

    assert.deepEqual(sentMessages, []);
    assert.deepEqual(app.toasts, [
      {
        message: 'Minimum checkout is 100 credits ($0.50) due to Stripe limits',
        type: 'info',
      },
    ]);
  });

  test('sends valid custom credits as a payment checkout payload', async () => {
    const app = createApp();

    await createCustomCreditCheckout(app, 100);

    assert.equal(app.toasts.length, 0);
    assert.deepEqual(sentMessages, [
      {
        action: 'pcCreateCheckout',
        priceId: undefined,
        creditAmount: 100,
        credit_amount: 100,
        credits: 100,
        accessToken: 'access-token',
        supabaseUrl: 'https://example.supabase.co',
        anonKey: 'anon-key',
        mode: 'payment',
      },
    ]);
  });

  test('sends subscription checkouts with price id and subscription mode', async () => {
    const app = createApp();

    await createCheckout(app, 'price_basic');

    assert.equal(app.toasts.length, 0);
    assert.deepEqual(sentMessages, [
      {
        action: 'pcCreateCheckout',
        priceId: 'price_basic',
        creditAmount: undefined,
        credit_amount: undefined,
        credits: undefined,
        accessToken: 'access-token',
        supabaseUrl: 'https://example.supabase.co',
        anonKey: 'anon-key',
        mode: 'subscription',
      },
    ]);
  });
});
