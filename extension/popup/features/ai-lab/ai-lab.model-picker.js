/**
 * Header + AI Lab model picker UI (data-action delegation).
 * @forward-slice
 */

import {
  canUseModelPicker,
  getShowcaseCreditCost,
  isUnlimitedAi,
  listPickerModels,
  resolveShowcaseModelFromWorkflow,
  workflowFromShowcaseModel,
  getShowcaseModelById,
} from './ai-lab.models.js';
import { AI_SELECTORS, byId } from './ai-lab.selectors.js';

let _eventsBound = false;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function optionLabel(model, unlimited) {
  if (unlimited) return model.label;
  return `${model.label} · ${getShowcaseCreditCost(model)} cr`;
}

function fillModelSelect(select, ctx) {
  if (!select) return;
  select.innerHTML = ctx.models
    .map((m) => {
      const sel = m.id === ctx.selected.id ? ' selected' : '';
      const tip = escapeHtml(m.tagline || m.strength || '');
      return `<option value="${escapeHtml(m.id)}" title="${tip}"${sel}>${escapeHtml(optionLabel(m, ctx.unlimited))}</option>`;
    })
    .join('');
  select.disabled = !ctx.allowed;
  select.title = ctx.allowed
    ? `AI model: ${ctx.selected.label}`
    : 'Upgrade or redeem AI access to pick a model';
  select.setAttribute('aria-label', 'Select AI model');
}

function fillModelSelects(ctx) {
  fillModelSelect(ctx.headerSelect, ctx);
  fillModelSelect(ctx.labTitleSelect, ctx);
}

function costHtml(model, unlimited) {
  if (unlimited) return '<span class="ai-model-card-cost">Unlimited</span>';
  return `<span class="ai-model-card-cost">${getShowcaseCreditCost(model)} cr</span>`;
}

function renderShowcaseCard(model, ctx) {
  const active = model.id === ctx.selected.id ? ' is-active' : '';
  const locked = ctx.allowed ? '' : ' is-locked';
  const disabled = ctx.allowed ? '' : 'disabled';
  const pressed = model.id === ctx.selected.id ? 'true' : 'false';
  const id = escapeHtml(model.id);
  const label = escapeHtml(model.label);
  return (
    `<div class="ai-model-card-wrap${active}${locked}">` +
    `<button type="button" class="ai-model-card${active}${locked}"` +
    ` data-action="select-ai-model" data-model-id="${id}"` +
    ` ${disabled} aria-pressed="${pressed}">` +
    `<span class="ai-model-card-label">${label}</span>` +
    `${costHtml(model, ctx.unlimited)}` +
    `<span class="ai-model-card-strength">${escapeHtml(model.strength)}</span>` +
    `</button>` +
    `<button type="button" class="ai-model-card-info info-icon"` +
    ` data-action="ai-model-info" data-model-id="${id}"` +
    ` aria-label="About ${label}" title="About ${label}">i</button>` +
    `</div>`
  );
}

function fillShowcase(ctx) {
  const showcase = ctx.showcase;
  if (!showcase) return;
  showcase.hidden = false;
  showcase.innerHTML = ctx.models.map((m) => renderShowcaseCard(m, ctx)).join('');
}

function fillHint(ctx) {
  const hint = ctx.hint;
  if (!hint) return;
  hint.textContent = ctx.allowed
    ? `${ctx.selected.label} — ${ctx.selected.strength}`
    : 'AI model picker unlocks with Premium, credit packs, or unlimited access.';
}

function revealPickerWrap(wrapId, allowed) {
  const wrap = byId(wrapId);
  if (!wrap) return;
  wrap.hidden = false;
  wrap.style.display = 'flex';
  wrap.classList.toggle('is-locked', !allowed);
}

function buildPickerCtx(app) {
  const subscription = app?.userSubscription || null;
  return {
    allowed: canUseModelPicker(subscription),
    unlimited: isUnlimitedAi(subscription),
    models: listPickerModels(subscription),
    selected: resolveShowcaseModelFromWorkflow(app?.aiWorkflow),
    headerSelect: byId(AI_SELECTORS.headerModelSelect),
    labTitleSelect: byId(AI_SELECTORS.labTitleModelSelect),
    showcase: byId(AI_SELECTORS.labModelShowcase),
    hint: byId(AI_SELECTORS.labModelHint),
  };
}

function closeAiModelInfoModal() {
  const modal = byId(AI_SELECTORS.modelInfoModal);
  if (modal) modal.style.display = 'none';
}

function openAiModelInfoModal(app, modelId) {
  const model = getShowcaseModelById(modelId);
  if (!model) return;
  const modal = byId(AI_SELECTORS.modelInfoModal);
  const titleEl = byId(AI_SELECTORS.modelInfoTitle);
  const taglineEl = byId(AI_SELECTORS.modelInfoTagline);
  const costEl = byId(AI_SELECTORS.modelInfoCost);
  const descEl = byId(AI_SELECTORS.modelInfoDescription);
  if (!modal || !titleEl || !taglineEl || !costEl || !descEl) return;

  const unlimited = isUnlimitedAi(app?.userSubscription);
  titleEl.textContent = model.label;
  taglineEl.textContent = model.tagline || model.strength || '';
  costEl.textContent = unlimited
    ? 'Cost: Unlimited'
    : `Cost: ${getShowcaseCreditCost(model)} credits per use`;
  descEl.textContent = model.description || '';
  modal.style.display = 'flex';
}

/** Promote showcase default into enabled aiWorkflow once AI access is available. */
export async function ensureDefaultWorkflowEnabled(app) {
  if (!canUseModelPicker(app?.userSubscription)) return null;
  // In-memory default is openai/default/enabled:false until hydrate — never persist that
  // as GPT-4o or a refresh wipes the user's last showcase pick (e.g. Gemini 3.6).
  if (!app?._aiWorkflowHydrated) return null;
  const cfg = app._normalizeAiWorkflow?.(app.aiWorkflow) || app.aiWorkflow;
  if (cfg?.enabled === true) return cfg;
  const model = resolveShowcaseModelFromWorkflow(cfg);
  return persistShowcaseSelection(app, model, true);
}

export function renderAiModelPicker(app) {
  const ctx = buildPickerCtx(app);
  fillModelSelects(ctx);
  revealPickerWrap(AI_SELECTORS.headerModelPicker, ctx.allowed);
  revealPickerWrap(AI_SELECTORS.labTitleModelPicker, ctx.allowed);
  fillShowcase(ctx);
  fillHint(ctx);
}

async function persistShowcaseSelection(app, model, silent) {
  app.aiWorkflow = app._normalizeAiWorkflow(workflowFromShowcaseModel(model));
  app.applyAiWorkflowToUi();
  const saved = await app.saveAiWorkflowFromUi?.(silent);
  if (!silent && saved) app.showToast?.(`AI model: ${model.label}`);
  return saved || app.aiWorkflow;
}

export async function selectAiShowcaseModel(app, modelId, { silent = true } = {}) {
  if (!canUseModelPicker(app?.userSubscription)) {
    if (!silent) app?.showToast?.('AI access required to change models', 'error');
    return null;
  }
  const model = getShowcaseModelById(modelId);
  if (!model) return null;
  return persistShowcaseSelection(app, model, silent);
}

function bindSelectChange(select, app) {
  if (!select) return;
  select.addEventListener('change', async () => {
    await selectAiShowcaseModel(app, select.value, { silent: false });
  });
}

function bindAiModelInfoModalEvents() {
  const closeBtn = byId(AI_SELECTORS.modelInfoClose);
  if (closeBtn) closeBtn.addEventListener('click', closeAiModelInfoModal);
  const doneBtn = byId(AI_SELECTORS.modelInfoDone);
  if (doneBtn) doneBtn.addEventListener('click', closeAiModelInfoModal);
  const overlay = byId(AI_SELECTORS.modelInfoModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target.id === AI_SELECTORS.modelInfoModal) closeAiModelInfoModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = byId(AI_SELECTORS.modelInfoModal);
    if (modal && modal.style.display === 'flex') closeAiModelInfoModal();
  });
}

export function bindAiModelPickerEvents(app) {
  if (_eventsBound) return;
  _eventsBound = true;

  bindSelectChange(byId(AI_SELECTORS.headerModelSelect), app);
  bindSelectChange(byId(AI_SELECTORS.labTitleModelSelect), app);
  bindAiModelInfoModalEvents();

  const showcase = byId(AI_SELECTORS.labModelShowcase);
  if (!showcase) return;
  showcase.addEventListener('click', async (e) => {
    const infoBtn = e.target.closest('[data-action="ai-model-info"]');
    if (infoBtn) {
      e.stopPropagation();
      const infoId = infoBtn.getAttribute('data-model-id');
      if (infoId) openAiModelInfoModal(app, infoId);
      return;
    }
    const btn = e.target.closest('[data-action="select-ai-model"]');
    if (!btn || btn.disabled) return;
    const modelId = btn.getAttribute('data-model-id');
    if (modelId) await selectAiShowcaseModel(app, modelId, { silent: false });
  });
}
