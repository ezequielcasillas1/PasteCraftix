import { SUPPORT_FORM_TYPES, SUPPORT_BUTTON_PAIRS, BILLING_ELEMENT_IDS } from './billing.constants.js';
import {
  getSupportModal,
  getSupportTitle,
  getSupportInfo,
  getSupportFields,
  getSupportSubject,
  getSupportDescription,
  getSupportStatus,
  getSendBtn,
  getCloseBtn,
  getCancelBtn,
} from './billing.selectors.js';

const SUPPORT_FORM_SCHEMAS = Object.freeze({
  [SUPPORT_FORM_TYPES.REPORT_BUGS]: {
    blurb: 'Report bugs and UX/UI discrepancies.',
    fields: [
      { key: 'where', label: 'Where did it happen? (optional)', type: 'text', maxLen: 160, placeholder: 'Page, feature, or screen' },
      { key: 'steps', label: 'Steps to reproduce (optional)', type: 'textarea', maxLen: 800, placeholder: '1) …\n2) …\n3) …' },
      { key: 'expected_vs_actual', label: 'Expected vs actual (optional)', type: 'textarea', maxLen: 800, placeholder: 'Expected …\nActual …' },
    ],
  },
  [SUPPORT_FORM_TYPES.HELP]: {
    blurb: 'How do I use the app? Where do I find this feature? Add examples.',
    fields: [
      { key: 'feature', label: 'Feature / question (optional)', type: 'text', maxLen: 160, placeholder: 'What are you trying to do?' },
      { key: 'example', label: 'Example (optional)', type: 'textarea', maxLen: 800, placeholder: 'Example input/output or scenario…' },
    ],
  },
  [SUPPORT_FORM_TYPES.SUPPORT]: {
    blurb: 'Login, signup, errors, and account/subscription concerns.',
    fields: [
      { key: 'category', label: 'Category (optional)', type: 'select', options: ['Login', 'Signup', 'Error', 'Account', 'Subscription', 'Other'] },
      { key: 'error_message', label: 'Error message (optional)', type: 'textarea', maxLen: 800, placeholder: 'Paste the exact error message (if any)…' },
    ],
  },
  [SUPPORT_FORM_TYPES.HOW_CAN_WE_IMPROVE]: {
    blurb: 'Feature requests and UX/UI improvements.',
    fields: [
      { key: 'request_type', label: 'Request type (optional)', type: 'select', options: ['Feature request', 'UX/UI improvement', 'Other'] },
      { key: 'why', label: 'Why this matters (optional)', type: 'textarea', maxLen: 800, placeholder: 'What problem does this solve? What would "better" look like?' },
    ],
  },
  [SUPPORT_FORM_TYPES.TEAM]: {
    blurb: 'Talk to the team, work for us, partnerships, etc.',
    fields: [
      { key: 'topic', label: 'Topic (optional)', type: 'select', options: ['Talk to the team', 'Work for us', 'Partnership', 'Press', 'Other'] },
      { key: 'contact', label: 'Best way to contact you (optional)', type: 'text', maxLen: 160, placeholder: "Email/phone/link (we'll reply to your account email by default)" },
      { key: 'links', label: 'Links (optional)', type: 'textarea', maxLen: 800, placeholder: 'Portfolio, LinkedIn, website, docs…' },
    ],
  },
});

const SUPPORT_TITLES = Object.freeze({
  [SUPPORT_FORM_TYPES.TEAM]: 'Team',
  [SUPPORT_FORM_TYPES.HELP]: 'Help',
  [SUPPORT_FORM_TYPES.SUPPORT]: 'Support',
  [SUPPORT_FORM_TYPES.HOW_CAN_WE_IMPROVE]: 'How can we improve?',
  [SUPPORT_FORM_TYPES.REPORT_BUGS]: 'Report a bug',
});

function _getSchema(type) {
  return SUPPORT_FORM_SCHEMAS[type] || { blurb: '', fields: [] };
}

function _buildFreemiumNotice(app) {
  const notice = document.createElement('div');
  notice.className = 'freemium-account-notice';
  notice.innerHTML =
    '<div class="notice-title">⚠️ Account Required for Email Support</div>' +
    '<div class="notice-text">Create a free account to get email support priority.<br>Without an account, we cannot reply to your request.</div>' +
    '<button class="notice-btn" id="freemiumCreateAccountBtn">Create Free Account</button>';
  return notice;
}

function _wireFreemiumBtn(app) {
  const btn = document.getElementById('freemiumCreateAccountBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    closeSupportForm();
    app._isFreemiumGuest = false;
    chrome.storage.local.remove('pc_freemium_guest');
    app.showAuthModal();
    const signupTab = document.querySelector('[data-auth-tab="signup"]');
    if (signupTab) signupTab.click();
  });
}

function _buildInfoSection(app, schema) {
  const infoEl = getSupportInfo();
  if (!infoEl) return;
  infoEl.innerHTML = '';

  if (app._isFreemiumGuest) {
    infoEl.appendChild(_buildFreemiumNotice(app));
    setTimeout(() => _wireFreemiumBtn(app), 0);
  }

  const userEmail = app.currentUser?.email || '';
  const line1 = document.createElement('div');
  line1.textContent = app._isFreemiumGuest
    ? 'You are using PasteCraft without an account.'
    : userEmail
      ? `From: ${userEmail} • We'll reply to this email.`
      : `We'll reply to your PasteCraft account email.`;
  infoEl.appendChild(line1);

  if (schema.blurb) {
    const line2 = document.createElement('div');
    line2.textContent = schema.blurb;
    line2.style.marginTop = '6px';
    line2.style.color = '#374151';
    infoEl.appendChild(line2);
  }
}

function _buildTextareaField(field) {
  const ta = document.createElement('textarea');
  ta.className = 'support-form-textarea';
  if (field.maxLen) ta.maxLength = field.maxLen;
  if (field.placeholder) ta.placeholder = field.placeholder;
  ta.rows = 3;
  return ta;
}

function _buildSelectField(field) {
  const sel = document.createElement('select');
  sel.className = 'support-form-input';
  const optEmpty = document.createElement('option');
  optEmpty.value = '';
  optEmpty.textContent = 'Select…';
  sel.appendChild(optEmpty);
  for (const opt of field.options || []) {
    const o = document.createElement('option');
    o.value = String(opt);
    o.textContent = String(opt);
    sel.appendChild(o);
  }
  return sel;
}

function _buildTextField(field) {
  const inp = document.createElement('input');
  inp.className = 'support-form-input';
  inp.type = 'text';
  if (field.maxLen) inp.maxLength = field.maxLen;
  if (field.placeholder) inp.placeholder = field.placeholder;
  return inp;
}

function _buildFieldInput(field) {
  if (field.type === 'textarea') return _buildTextareaField(field);
  if (field.type === 'select') return _buildSelectField(field);
  return _buildTextField(field);
}

function _buildFieldsSection(schema) {
  const fieldsEl = getSupportFields();
  if (!fieldsEl) return;
  fieldsEl.innerHTML = '';

  for (const field of schema.fields || []) {
    if (!field?.key) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'support-form-field';

    const label = document.createElement('label');
    const inputId = `supportField_${field.key}`;
    label.htmlFor = inputId;
    label.textContent = field.label || field.key;

    const inputEl = _buildFieldInput(field);
    inputEl.id = inputId;
    inputEl.setAttribute('data-support-field', field.key);

    wrapper.appendChild(label);
    wrapper.appendChild(inputEl);
    fieldsEl.appendChild(wrapper);
  }
}

function _resetStatusFields() {
  const subjectEl = getSupportSubject();
  const descEl = getSupportDescription();
  const statusEl = getSupportStatus();
  if (subjectEl) subjectEl.value = '';
  if (descEl) descEl.value = '';
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.textContent = '';
    statusEl.style.color = '#111827';
  }
}

export function openSupportForm(app, type) {
  app.currentSupportFormType = type;

  const titleEl = getSupportTitle();
  if (titleEl) titleEl.textContent = SUPPORT_TITLES[type] || 'Contact PasteCraft';

  const schema = _getSchema(type);
  _buildInfoSection(app, schema);
  _buildFieldsSection(schema);
  _resetStatusFields();

  const modal = getSupportModal();
  if (modal) modal.style.display = 'flex';
}

export function closeSupportForm() {
  const modal = getSupportModal();
  if (modal) modal.style.display = 'none';
}

function _collectSupportFields() {
  const fields = {};
  try {
    const fieldEls = document.querySelectorAll('#supportFormFields [data-support-field]');
    fieldEls.forEach((el) => {
      const key = el?.getAttribute?.('data-support-field');
      if (!key) return;
      const raw = typeof el.value === 'string' ? el.value : '';
      const val = raw.trim();
      if (val) fields[key] = val;
    });
  } catch (_) {
    // ignore field collection failures
  }
  return fields;
}

function _validateSupportForm(app, subject, description) {
  if (!subject || !description) {
    app.showToast('⚠️ Please add subject and description', 'error');
    return false;
  }
  return true;
}

function _setSendButtonState(sendBtn, disabled, text) {
  if (!sendBtn) return;
  sendBtn.disabled = disabled;
  sendBtn.textContent = text;
}

function _setStatusMessage(statusEl, visible, color, text) {
  if (!statusEl) return;
  statusEl.style.display = visible ? 'block' : 'none';
  statusEl.style.color = color;
  statusEl.textContent = text;
}

async function _submitSupportRequest(app, type, subject, description, fields) {
  const { data: { session } } = await window.pasteCraftSupabase.client.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    app.showToast('🔑 Please sign in again', 'error');
    return { ok: false, status: 401 };
  }

  const endpoint = `https://pastecraft.com/.netlify/functions/support-ticket?v=${Date.now()}`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type, subject, description, fields }),
  });

  return { ok: resp.ok, status: resp.status };
}

export async function submitSupportForm(app) {
  const type = app.currentSupportFormType;
  const subjectEl = getSupportSubject();
  const descEl = getSupportDescription();
  const statusEl = getSupportStatus();
  const sendBtn = getSendBtn();

  const subject = (subjectEl?.value || '').trim();
  const description = (descEl?.value || '').trim();

  if (!_validateSupportForm(app, subject, description)) return;

  const fields = _collectSupportFields();

  try {
    _setSendButtonState(sendBtn, true, 'Sending...');
    _setStatusMessage(statusEl, true, '#111827', 'Sending…');

    const result = await _submitSupportRequest(app, type, subject, description, fields);

    if (!result.ok) {
      console.error('Support ticket failed:', result.status);
      app.showToast('❌ Could not send message', 'error');
      const msg = result.status === 429
        ? 'Too many requests. Please wait a moment and try again.'
        : 'Failed to send. Please try again.';
      _setStatusMessage(statusEl, true, '#b91c1c', msg);
      return;
    }

    app.showToast('✅ Sent', 'success');
    _setStatusMessage(statusEl, true, '#065f46', 'Sent successfully.');
    setTimeout(() => closeSupportForm(), 600);
  } catch (e) {
    console.error('Support ticket error:', e);
    app.showToast('❌ Could not send message', 'error');
    _setStatusMessage(statusEl, true, '#b91c1c', 'Failed to send. Please try again.');
  } finally {
    _setSendButtonState(sendBtn, false, 'Send');
  }
}

export function openSupportFormSafely(app, type) {
  try {
    openSupportForm(app, type);
  } catch (e) {
    console.error('Support form open failed:', e);
    app.showToast('❌ Could not open support form', 'error');
  }
}

function _isSupportModalBackdrop(e) {
  return !!(e && e.target && e.target.id === BILLING_ELEMENT_IDS.supportFormModal);
}

function _wireSupportOpenButtons(app) {
  SUPPORT_BUTTON_PAIRS.forEach(([id, type]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => openSupportFormSafely(app, type));
  });
}

function _wireSupportFormControls(app) {
  const closeBtn = getCloseBtn();
  if (closeBtn) closeBtn.addEventListener('click', () => closeSupportForm());

  const cancelBtn = getCancelBtn();
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeSupportForm());

  const modal = getSupportModal();
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (_isSupportModalBackdrop(e)) closeSupportForm();
    });
  }

  const sendBtn = getSendBtn();
  if (sendBtn) sendBtn.addEventListener('click', () => submitSupportForm(app));
}

export function initSupportEvents(app) {
  _wireSupportOpenButtons(app);
  _wireSupportFormControls(app);
}
