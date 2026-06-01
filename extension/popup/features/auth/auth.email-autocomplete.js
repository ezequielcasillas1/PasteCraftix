import { AUTH_ELEMENT_IDS } from './auth.constants.js';
import {
  filterVerifiedEmails,
  getLastUsedVerifiedEmail,
} from './auth.email-cache.js';

function getSigninEmailInput() {
  return document.getElementById(AUTH_ELEMENT_IDS.SIGNIN_EMAIL);
}

function getOrCreateSuggestionsList(input) {
  let listEl = document.getElementById(AUTH_ELEMENT_IDS.SIGNIN_EMAIL_SUGGESTIONS);
  if (listEl) return listEl;

  listEl = document.createElement('div');
  listEl.id = AUTH_ELEMENT_IDS.SIGNIN_EMAIL_SUGGESTIONS;
  listEl.className = 'auth-email-suggestions';
  listEl.setAttribute('role', 'listbox');
  listEl.setAttribute('aria-label', 'Previously signed-in emails');
  listEl.hidden = true;
  input.parentElement?.appendChild(listEl);
  return listEl;
}

function hideSuggestions(input, listEl) {
  listEl.hidden = true;
  listEl.innerHTML = '';
  input.setAttribute('aria-expanded', 'false');
}

function highlightMatch(email, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle || !email.toLowerCase().includes(needle)) {
    return email;
  }
  const idx = email.toLowerCase().indexOf(needle);
  const before = email.slice(0, idx);
  const match = email.slice(idx, idx + needle.length);
  const after = email.slice(idx + needle.length);
  return `${before}<strong>${match}</strong>${after}`;
}

function renderSuggestions(input, listEl, emails, query, activeIndex) {
  listEl.innerHTML = '';
  if (!emails.length) {
    hideSuggestions(input, listEl);
    return;
  }

  emails.forEach((email, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'auth-email-suggestion-item';
    btn.setAttribute('role', 'option');
    btn.dataset.email = email;
    btn.innerHTML = `<span class="auth-email-suggestion-icon">📧</span><span class="auth-email-suggestion-text">${highlightMatch(email, query)}</span>`;
    if (index === activeIndex) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.setAttribute('aria-selected', 'false');
    }
    listEl.appendChild(btn);
  });

  listEl.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

export async function applyLastVerifiedEmailToSignin() {
  const input = getSigninEmailInput();
  if (!input || input.value.trim()) return;
  const last = await getLastUsedVerifiedEmail();
  if (last) input.value = last;
}

export function initSigninEmailAutocomplete() {
  const input = getSigninEmailInput();
  if (!input || input.dataset.emailAutocompleteBound === '1') return;

  input.dataset.emailAutocompleteBound = '1';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', AUTH_ELEMENT_IDS.SIGNIN_EMAIL_SUGGESTIONS);
  input.setAttribute('aria-expanded', 'false');

  const listEl = getOrCreateSuggestionsList(input);
  let activeIndex = -1;
  let blurTimer = null;

  const refresh = async () => {
    const query = input.value.trim();
    const emails = await filterVerifiedEmails(query);
    if (activeIndex >= emails.length) activeIndex = emails.length - 1;
    renderSuggestions(input, listEl, emails, query, activeIndex);
  };

  const selectEmail = (email) => {
    input.value = email;
    hideSuggestions(input, listEl);
    activeIndex = -1;
    input.focus();
  };

  input.addEventListener('input', () => {
    activeIndex = -1;
    refresh().catch(() => {});
  });

  input.addEventListener('focus', () => {
    clearTimeout(blurTimer);
    refresh().catch(() => {});
  });

  input.addEventListener('blur', () => {
    blurTimer = setTimeout(() => hideSuggestions(input, listEl), 150);
  });

  input.addEventListener('keydown', (event) => {
    const items = [...listEl.querySelectorAll('.auth-email-suggestion-item')];
    if (!items.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      refresh().catch(() => {});
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      refresh().catch(() => {});
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectEmail(items[activeIndex].dataset.email || '');
      return;
    }

    if (event.key === 'Escape') {
      hideSuggestions(input, listEl);
      activeIndex = -1;
    }
  });

  listEl.addEventListener('mousedown', (event) => {
    const item = event.target.closest('.auth-email-suggestion-item');
    if (!item) return;
    event.preventDefault();
    selectEmail(item.dataset.email || '');
  });
}
