/**
 * Billing price contract regression tests.
 * Run: node --test tests/billing-price-contract.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';

import { BILLING_PRICE_IDS } from '../extension/popup/features/billing/billing.constants.js';
import { registerBillingUpgradeEvents } from '../extension/popup/events/billing-upgrade.events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readPopupIntervalButtons() {
  const popupHtml = fs.readFileSync(path.join(root, 'extension/popup.html'), 'utf8');
  const buttons = [];
  const buttonPattern = /<button\s+([^>]*class="[^"]*\binterval-btn\b[^"]*"[^>]*)>([\s\S]*?)<\/button>/g;

  for (const [, rawAttrs, rawText] of popupHtml.matchAll(buttonPattern)) {
    const attrs = {};
    for (const [, name, value] of rawAttrs.matchAll(/([\w-]+)="([^"]*)"/g)) {
      attrs[name] = value;
    }
    buttons.push({
      label: rawText.replace(/<[^>]*>/g, '').trim(),
      className: attrs.class || '',
      plan: attrs['data-plan'],
      priceId: attrs['data-price-id'],
      price: attrs['data-price'],
      period: attrs['data-period'],
    });
  }

  return buttons;
}

function createMockElement(id, attrs = {}) {
  const listeners = new Map();
  const classes = new Set(String(attrs.className || '').split(/\s+/).filter(Boolean));

  return {
    id,
    dataset: attrs.dataset || {},
    innerHTML: '',
    classList: {
      add(...names) {
        names.forEach((name) => classes.add(name));
      },
      remove(...names) {
        names.forEach((name) => classes.delete(name));
      },
      contains(name) {
        return classes.has(name);
      },
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    click() {
      for (const fn of listeners.get('click') || []) {
        fn({ target: this, preventDefault() {}, stopPropagation() {} });
      }
    },
  };
}

function buildBillingDocumentHarness() {
  const intervalButtons = readPopupIntervalButtons().map((button) =>
    createMockElement(`${button.plan}-${button.label.toLowerCase()}`, {
      className: button.className,
      dataset: {
        plan: button.plan,
        priceId: button.priceId,
        price: button.price,
        period: button.period,
      },
    })
  );
  const byId = new Map(
    [
      'upgradeBanner',
      'upgradeSubBtn',
      'upgradeModalClose',
      'upgradeModal',
      'basicPriceDisplay',
      'enhancedPriceDisplay',
      'upgradeBtnBasic',
      'upgradeBtnEnhanced',
    ].map((id) => [id, createMockElement(id)])
  );

  return {
    getElementById(id) {
      return byId.get(id) || null;
    },
    querySelectorAll(selector) {
      const plan = selector.match(/^\.interval-btn\[data-plan="([^"]+)"\]$/)?.[1];
      if (!plan) return [];
      return intervalButtons.filter((button) => button.dataset.plan === plan);
    },
  };
}

function extractPriceArray(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]`));
  assert.ok(match, `Missing ${name}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, priceId]) => priceId);
}

function getTextCreditPolicyFor(source, priceId) {
  const caseIndex = source.indexOf(`case '${priceId}'`);
  if (caseIndex === -1) return null;
  const match = source
    .slice(caseIndex)
    .match(/return\s+\{\s+grant:\s+([\d_]+),\s+cap:\s+([\d_]+)\s+\}/);
  if (!match) return null;
  return {
    grant: Number(match[1].replaceAll('_', '')),
    cap: Number(match[2].replaceAll('_', '')),
  };
}

describe('billing price contract', () => {
  test('popup interval buttons use billing constants and safe defaults', () => {
    const buttons = readPopupIntervalButtons();
    const byPlanLabel = new Map(buttons.map((button) => [`${button.plan}:${button.label}`, button]));

    assert.equal(byPlanLabel.get('basic:Weekly')?.priceId, BILLING_PRICE_IDS.BASIC_WEEKLY);
    assert.equal(byPlanLabel.get('basic:Monthly')?.priceId, BILLING_PRICE_IDS.BASIC_MONTHLY);
    assert.equal(byPlanLabel.get('basic:Yearly')?.priceId, BILLING_PRICE_IDS.BASIC_YEARLY);
    assert.equal(byPlanLabel.get('enhanced:Weekly')?.priceId, BILLING_PRICE_IDS.ENHANCED_WEEKLY);
    assert.equal(byPlanLabel.get('enhanced:Monthly')?.priceId, BILLING_PRICE_IDS.ENHANCED_MONTHLY);
    assert.equal(byPlanLabel.get('enhanced:Yearly')?.priceId, BILLING_PRICE_IDS.ENHANCED_YEARLY);

    assert.match(byPlanLabel.get('basic:Monthly')?.className || '', /\bactive\b/);
    assert.match(byPlanLabel.get('enhanced:Weekly')?.className || '', /\bactive\b/);
  });

  test('selected interval price ID is sent to checkout', () => {
    const priorDocument = globalThis.document;
    const checkoutPriceIds = [];
    globalThis.document = buildBillingDocumentHarness();

    try {
      registerBillingUpgradeEvents({
        openUpgradeModal() {},
        closeUpgradeModal() {},
        _createCheckout(priceId) {
          checkoutPriceIds.push(priceId);
        },
      });

      const [basicWeekly, , basicYearly] = document.querySelectorAll('.interval-btn[data-plan="basic"]');
      const [, enhancedMonthly] = document.querySelectorAll('.interval-btn[data-plan="enhanced"]');

      basicYearly.click();
      document.getElementById('upgradeBtnBasic').click();
      assert.equal(checkoutPriceIds.at(-1), BILLING_PRICE_IDS.BASIC_YEARLY);
      assert.equal(document.getElementById('basicPriceDisplay').innerHTML, '$9.99<span>/year</span>');
      assert.equal(basicWeekly.classList.contains('active'), false);
      assert.equal(basicYearly.classList.contains('active'), true);

      enhancedMonthly.click();
      document.getElementById('upgradeBtnEnhanced').click();
      assert.equal(checkoutPriceIds.at(-1), BILLING_PRICE_IDS.ENHANCED_MONTHLY);
      assert.equal(document.getElementById('enhancedPriceDisplay').innerHTML, '$4.99<span>/month</span>');
    } finally {
      globalThis.document = priorDocument;
    }
  });

  test('stripe webhook recognizes popup price IDs and grants enhanced text credits', () => {
    const webhookSource = fs.readFileSync(
      path.join(root, 'supabase/functions/stripe-webhook/index.ts'),
      'utf8'
    );
    const basicIds = extractPriceArray(webhookSource, 'BASIC_PRICE_IDS');
    const premiumIds = extractPriceArray(webhookSource, 'PREMIUM_PRICE_IDS');

    assert.deepEqual(
      [BILLING_PRICE_IDS.BASIC_WEEKLY, BILLING_PRICE_IDS.BASIC_MONTHLY, BILLING_PRICE_IDS.BASIC_YEARLY].every((id) =>
        basicIds.includes(id)
      ),
      true
    );
    assert.deepEqual(
      [
        BILLING_PRICE_IDS.ENHANCED_WEEKLY,
        BILLING_PRICE_IDS.ENHANCED_MONTHLY,
        BILLING_PRICE_IDS.ENHANCED_YEARLY,
      ].every((id) => premiumIds.includes(id)),
      true
    );

    assert.deepEqual(getTextCreditPolicyFor(webhookSource, BILLING_PRICE_IDS.ENHANCED_WEEKLY), {
      grant: 4000,
      cap: 20000,
    });
    assert.deepEqual(getTextCreditPolicyFor(webhookSource, BILLING_PRICE_IDS.ENHANCED_MONTHLY), {
      grant: 35000,
      cap: 35000,
    });
    assert.deepEqual(getTextCreditPolicyFor(webhookSource, BILLING_PRICE_IDS.ENHANCED_YEARLY), {
      grant: 500000,
      cap: 500000,
    });
    assert.equal(getTextCreditPolicyFor(webhookSource, BILLING_PRICE_IDS.BASIC_MONTHLY), null);
  });
});
