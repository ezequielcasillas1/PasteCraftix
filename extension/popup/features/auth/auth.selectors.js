import { AUTH_ELEMENT_IDS, AUTH_TAB_SELECTOR } from './auth.constants.js';

export function getAuthModal() {
  return document.getElementById(AUTH_ELEMENT_IDS.AUTH_MODAL);
}

export function getSigninForm() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNIN_FORM);
}

export function getSignupForm() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNUP_FORM);
}

export function getPasswordResetModal() {
  return document.getElementById(AUTH_ELEMENT_IDS.PASSWORD_RESET_MODAL);
}

export function getNewPasswordModal() {
  return document.getElementById(AUTH_ELEMENT_IDS.NEW_PASSWORD_MODAL);
}

export function getAuthTabs() {
  return document.querySelectorAll(AUTH_TAB_SELECTOR);
}

export function getSigninEmailValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNIN_EMAIL)?.value || '';
}

export function getSigninPasswordValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNIN_PASSWORD)?.value || '';
}

export function getSignupEmailValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNUP_EMAIL)?.value || '';
}

export function getSignupPasswordValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNUP_PASSWORD)?.value || '';
}

export function getSignupPasswordConfirmValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNUP_PASSWORD_CONFIRM)?.value || '';
}

export function isAgreeTermsChecked() {
  return !!document.getElementById(AUTH_ELEMENT_IDS.AGREE_TERMS)?.checked;
}

export function getResetEmailValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.RESET_EMAIL)?.value || '';
}

export function getNewPasswordValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.NEW_PASSWORD)?.value || '';
}

export function getConfirmNewPasswordValue() {
  return document.getElementById(AUTH_ELEMENT_IDS.CONFIRM_NEW_PASSWORD)?.value || '';
}
