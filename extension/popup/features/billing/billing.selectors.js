import { BILLING_ELEMENT_IDS } from './billing.constants.js';

export const getUpgradeModal = () => document.getElementById(BILLING_ELEMENT_IDS.upgradeModal);
export const getSupportModal = () => document.getElementById(BILLING_ELEMENT_IDS.supportFormModal);
export const getSupportTitle = () => document.getElementById(BILLING_ELEMENT_IDS.supportFormTitle);
export const getSupportInfo = () => document.getElementById(BILLING_ELEMENT_IDS.supportFormInfo);
export const getSupportFields = () => document.getElementById(BILLING_ELEMENT_IDS.supportFormFields);
export const getSupportSubject = () => document.getElementById(BILLING_ELEMENT_IDS.supportFormSubject);
export const getSupportDescription = () => document.getElementById(BILLING_ELEMENT_IDS.supportFormDescription);
export const getSupportStatus = () => document.getElementById(BILLING_ELEMENT_IDS.supportFormStatus);
export const getSendBtn = () => document.getElementById(BILLING_ELEMENT_IDS.sendSupportForm);
export const getCloseBtn = () => document.getElementById(BILLING_ELEMENT_IDS.closeSupportFormModal);
export const getCancelBtn = () => document.getElementById(BILLING_ELEMENT_IDS.cancelSupportForm);
