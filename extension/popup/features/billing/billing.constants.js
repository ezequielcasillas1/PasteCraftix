export const BILLING_PRICE_IDS = Object.freeze({
  BASIC: 'price_1SsbTZLOdeLTrjap9UnXhu0M',
  ENHANCED: 'price_1SUYs3LOdeLTrjapCFFDe7td',
});

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
