import { CRAFT_CATEGORY_SUGGESTION_COUNT } from './ai-lab.craft-clips.constants.js';

let pickEventsBound = false;
let pickResolve = null;

export function bindCraftCategoryPickEvents() {
  if (pickEventsBound) return;
  pickEventsBound = true;

  const modal = document.getElementById('craftCategoryPickModal');
  const applyBtn = document.getElementById('craftCategoryPickApply');
  const skipBtn = document.getElementById('craftCategoryPickSkip');
  const closeBtn = document.getElementById('closeCraftCategoryPick');
  const listEl = document.getElementById('craftCategoryPickList');

  const finish = (value) => {
    if (modal) modal.style.display = 'none';
    if (pickResolve) {
      const r = pickResolve;
      pickResolve = null;
      r(value);
    }
  };

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const option = e.target.closest('[data-craft-category-option]');
      if (!option) return;
      listEl.querySelectorAll('[data-craft-category-option]').forEach((el) => {
        el.classList.toggle('craft-category-pick-option--selected', el === option);
        const input = el.querySelector('input[type="radio"]');
        if (input) input.checked = el === option;
      });
      if (applyBtn) applyBtn.disabled = false;
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const selected = listEl?.querySelector('[data-craft-category-option].craft-category-pick-option--selected');
      const name = selected?.dataset?.craftCategoryName?.trim();
      finish(name || null);
    });
  }

  if (skipBtn) skipBtn.addEventListener('click', () => finish(null));
  if (closeBtn) closeBtn.addEventListener('click', () => finish(null));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'craftCategoryPickModal') finish(null);
    });
  }
}

export function openCraftCategoryPickModal(suggestions) {
  bindCraftCategoryPickEvents();

  const modal = document.getElementById('craftCategoryPickModal');
  const listEl = document.getElementById('craftCategoryPickList');
  const applyBtn = document.getElementById('craftCategoryPickApply');
  if (!modal || !listEl) return Promise.resolve(null);

  const titles = (Array.isArray(suggestions) ? suggestions : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, CRAFT_CATEGORY_SUGGESTION_COUNT);

  if (titles.length === 0) return Promise.resolve(null);

  listEl.innerHTML = titles.map((name, i) => `
    <label class="craft-category-pick-option" data-craft-category-option data-craft-category-name="${escapeAttr(name)}">
      <input type="radio" name="craftCategoryPick" value="${escapeAttr(name)}" ${i === 0 ? '' : ''}>
      <span class="craft-category-pick-option-text">${escapeHtml(name)}</span>
    </label>
  `).join('');

  if (applyBtn) applyBtn.disabled = true;
  modal.style.display = 'flex';

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch (_) { /* ignore */ }
  }

  return new Promise((resolve) => {
    pickResolve = resolve;
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}
