/** @forward-slice privacy — disclosure copy + ack version for Chrome store compliance */

export const PRIVACY_STORAGE_KEYS = Object.freeze({
  ACK_VERSION: 'pc_privacy_notice_ack_version',
});

/** Bump when data practices or disclosure copy change after install. */
export const PRIVACY_NOTICE_VERSION = 1;

export const PRIVACY_URLS = Object.freeze({
  POLICY: 'https://pastecraft.com/privacy',
  TERMS: 'https://pastecraft.com/terms',
});

export const PRIVACY_ELEMENT_IDS = Object.freeze({
  SECTION: 'privacyDisclosureSection',
  CHANGE_NOTICE: 'privacyChangeNotice',
  ACK_BTN: 'privacyAckBtn',
  POLICY_LINK: 'privacyPolicyLinkSettings',
  TERMS_LINK: 'privacyTermsLinkSettings',
});

export const PRIVACY_DISCLOSURE_ITEMS = Object.freeze([
  {
    title: 'Account data',
    body: 'Email and, if you use Google sign-in, your Google profile (email, name) for authentication.',
  },
  {
    title: 'Clips and preferences',
    body: 'Clipboard content and settings you save. Stored locally in the browser; synced to our cloud (Supabase) when you are signed in.',
  },
  {
    title: 'AI features',
    body: 'Text you submit for summaries, breakdowns, or similar AI tools is sent to AI providers only when you use those features.',
  },
  {
    title: 'Billing',
    body: 'Subscriptions and payments are handled by Stripe. PasteCraft does not store your full card details.',
  },
  {
    title: 'Support',
    body: 'If you contact support, we receive the subject and message you submit.',
  },
]);
