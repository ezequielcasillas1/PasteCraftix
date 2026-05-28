export const BILLING_PRICE_IDS = Object.freeze({
  BASIC: 'price_1SsbTZLOdeLTrjap9UnXhu0M',
  ENHANCED: 'price_1SUYs3LOdeLTrjapCFFDe7td',
});

/** Stripe one-time credit pack price IDs (test mode — May 2026). */
export const CREDIT_PACK_PRICE_IDS = Object.freeze({
  PACK_1000: 'price_1TcB5ULOdeLTrjapKaztK3oM',
  PACK_5000: 'price_1TcB5bLOdeLTrjapqQ8kXXgE',
});

export const CREDIT_PACKS = Object.freeze([
  { id: 'pack_1000', label: '1,000 credits', priceLabel: '$5', priceId: CREDIT_PACK_PRICE_IDS.PACK_1000, credits: 1000 },
  { id: 'pack_5000', label: '5,000 credits', priceLabel: '$15', priceId: CREDIT_PACK_PRICE_IDS.PACK_5000, credits: 5000 },
]);

export const SUPPORT_FORM_TYPES = Object.freeze({
  REPORT_BUGS: 'reportbugs',
  HELP: 'help',
  SUPPORT: 'support',
  HOW_CAN_WE_IMPROVE: 'howcanweimprove',
  TEAM: 'team',
});

export const BILLING_ELEMENT_IDS = Object.freeze({
  upgradeModal: 'upgradeModal',
  supportFormModal: 'supportFormModal',
  supportFormTitle: 'supportFormTitle',
  supportFormInfo: 'supportFormInfo',
  supportFormFields: 'supportFormFields',
  supportFormSubject: 'supportFormSubject',
  supportFormDescription: 'supportFormDescription',
  supportFormStatus: 'supportFormStatus',
  sendSupportForm: 'sendSupportForm',
  closeSupportFormModal: 'closeSupportFormModal',
  cancelSupportForm: 'cancelSupportForm',
});

export const SUPPORT_BUTTON_PAIRS = Object.freeze([
  ['supportTeamBtn', SUPPORT_FORM_TYPES.TEAM],
  ['supportHelpBtn', SUPPORT_FORM_TYPES.HELP],
  ['supportSupportBtn', SUPPORT_FORM_TYPES.SUPPORT],
  ['supportImproveBtn', SUPPORT_FORM_TYPES.HOW_CAN_WE_IMPROVE],
  ['supportReportBugsBtn', SUPPORT_FORM_TYPES.REPORT_BUGS],
]);
