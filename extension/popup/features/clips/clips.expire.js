import { findClipLocationById } from './clips.title.js';

import { CLIPS_STORAGE_KEYS } from './clips.constants.js';

import {

  CLIP_EXPIRY_PRESETS,

  clipHasActiveExpiry,

  computeExpiresAt,

  formatCountdownRemaining,

  formatExpiresAt,

  getExpirePresetLabel,

  getFutureWeekdayOptions,

  parseCustomDuration,

} from '../../../shared/clip-expiry.js';



const OVERLAY_ID = 'pcClipExpireOverlay';



let expireCountdownTimerId = null;




export function closeExpirePopover() {

  if (expireCountdownTimerId != null) {

    clearInterval(expireCountdownTimerId);

    expireCountdownTimerId = null;

  }

  document.getElementById(OVERLAY_ID)?.remove();

}



function stopExpireCountdown() {

  if (expireCountdownTimerId != null) {

    clearInterval(expireCountdownTimerId);

    expireCountdownTimerId = null;

  }

}



function positionExpirePopover(popover, anchorEl) {

  if (!popover || !anchorEl || typeof anchorEl.getBoundingClientRect !== 'function') return;

  const rect = anchorEl.getBoundingClientRect();

  const top = Math.min(rect.bottom + 6, window.innerHeight - 20);

  const left = Math.min(Math.max(8, rect.right - 280), window.innerWidth - 288);

  popover.style.top = `${top}px`;

  popover.style.left = `${left}px`;

}



function normalizeClipExpiryFields(clip) {

  if (!clip || clip.expiresAt == null) return clip;

  const expiresAt = Number(clip.expiresAt);

  if (!Number.isFinite(expiresAt) || expiresAt === clip.expiresAt) return clip;

  return { ...clip, expiresAt };

}



function resolveClipForDisplay(app, clipOrIdKey) {

  const idKey = typeof clipOrIdKey === 'object'

    ? app._clipIdKey(clipOrIdKey?.id)

    : app._clipIdKey(clipOrIdKey);

  if (!idKey) return typeof clipOrIdKey === 'object' ? normalizeClipExpiryFields(clipOrIdKey) : null;



  const location = findClipLocationById(app, idKey);

  const resolved = location?.clip ?? (typeof clipOrIdKey === 'object' ? clipOrIdKey : null);

  return normalizeClipExpiryFields(resolved);

}



function resolveExpireAnchor(clipIdKey, fallbackAnchor) {

  if (!clipIdKey) return fallbackAnchor;

  try {

    const btn = document.querySelector(

      `.chip[data-clip-id="${CSS.escape(String(clipIdKey))}"] .chip-expire-btn`,

    );

    return btn || fallbackAnchor;

  } catch (_) {

    return fallbackAnchor;

  }

}



function mountExpireShell(anchorEl) {

  const overlay = document.createElement('div');

  overlay.id = OVERLAY_ID;

  overlay.className = 'pc-expire-overlay';

  overlay.setAttribute('role', 'presentation');



  const popover = document.createElement('div');

  popover.className = 'pc-expire-popover';

  overlay.appendChild(popover);

  document.body.appendChild(overlay);

  positionExpirePopover(popover, anchorEl);



  const close = () => closeExpirePopover();

  overlay.addEventListener('click', (e) => {

    if (e.target === overlay) close();

  });



  return { overlay, popover, close };

}



function ensureExpireShell(anchorEl, { reuse = false } = {}) {

  if (reuse) {

    const overlay = document.getElementById(OVERLAY_ID);

    const popover = overlay?.querySelector('.pc-expire-popover');

    if (overlay && popover) {

      positionExpirePopover(popover, anchorEl);

      return { overlay, popover, close: () => closeExpirePopover() };

    }

  }



  closeExpirePopover();

  return mountExpireShell(anchorEl);

}



function renderWeekdayOptions(selected) {

  const options = getFutureWeekdayOptions();

  const noneSelected = selected == null || selected === '' ? 'selected' : '';

  let html = `<option value="" ${noneSelected}>No weekday</option>`;

  for (const opt of options) {

    const sel = String(selected) === String(opt.value) ? 'selected' : '';

    html += `<option value="${opt.value}" ${sel}>${opt.label}</option>`;

  }

  return html;

}



function renderPresetButtons(selectedKey) {

  return CLIP_EXPIRY_PRESETS.map((p) => {

    const active = p.key === selectedKey ? ' is-selected' : '';

    return `<button type="button" class="pc-expire-preset${active}" data-preset="${p.key}">${p.label}</button>`;

  }).join('');

}



function startCountdownTicker(popover, expiresAt, onExpired) {

  stopExpireCountdown();

  const countdownEl = popover.querySelector('[data-field="countdown"]');

  const barEl = popover.querySelector('[data-field="progressBar"]');



  const tick = () => {

    const now = Date.now();

    const remaining = expiresAt - now;

    if (countdownEl) {

      countdownEl.textContent = formatCountdownRemaining(expiresAt, now);

      countdownEl.classList.toggle('is-expired', remaining <= 0);

    }

    if (barEl && remaining > 0) {

      const windowMs = Math.min(remaining, 24 * 60 * 60 * 1000);

      const pct = Math.max(4, Math.min(100, (remaining / windowMs) * 100));

      barEl.style.width = `${pct}%`;

    }

    if (remaining <= 0) {

      stopExpireCountdown();

      onExpired?.();

    }

  };



  tick();

  expireCountdownTimerId = setInterval(tick, 1000);

}



function bindDetailsView(app, popover, liveClip, anchorEl, close, { reuseShell = false } = {}) {

  stopExpireCountdown();



  const clipIdKey = app._clipIdKey(liveClip.id);

  const resolvedAnchor = resolveExpireAnchor(clipIdKey, anchorEl);

  if (reuseShell) positionExpirePopover(popover, resolvedAnchor);



  const expiresAt = Number(liveClip.expiresAt);

  const presetLabel = getExpirePresetLabel(liveClip.expirePreset);

  const scheduleLine = app.escapeHtml(formatExpiresAt(expiresAt));

  const presetLine = presetLabel

    ? `<div class="pc-expire-detail-row"><span class="pc-expire-detail-label">Schedule</span><span class="pc-expire-detail-value">${app.escapeHtml(presetLabel)}</span></div>`

    : '';



  popover.setAttribute('role', 'dialog');

  popover.setAttribute('aria-label', 'Clip expiry details');

  popover.innerHTML = `

    <div class="pc-expire-header">

      <span class="pc-expire-title">Expiry scheduled</span>

      <button type="button" class="pc-expire-close" aria-label="Close expiry details">×</button>

    </div>

    <div class="pc-expire-details">

      <div class="pc-expire-countdown-wrap">

        <div class="pc-expire-countdown-label">Time remaining</div>

        <div class="pc-expire-countdown" data-field="countdown" aria-live="polite"></div>

        <div class="pc-expire-progress" aria-hidden="true"><div class="pc-expire-progress-bar" data-field="progressBar"></div></div>

      </div>

      <div class="pc-expire-detail-row">

        <span class="pc-expire-detail-label">Deletes at</span>

        <span class="pc-expire-detail-value">${scheduleLine}</span>

      </div>

      ${presetLine}

      <p class="pc-expire-detail-hint">This clip will be removed automatically when the timer ends.</p>

    </div>

    <div class="pc-expire-actions">

      <button type="button" class="btn-secondary pc-expire-change">Change</button>

      <button type="button" class="btn-secondary pc-expire-clear">Clear</button>

      <button type="button" class="btn-primary pc-expire-done">Done</button>

    </div>

  `;



  window.renderLucideIcons?.();



  popover.querySelector('.pc-expire-close')?.addEventListener('click', close);

  popover.querySelector('.pc-expire-done')?.addEventListener('click', close);



  popover.querySelector('.pc-expire-change')?.addEventListener('click', () => {

    const freshClip = resolveClipForDisplay(app, clipIdKey);

    bindSetupView(app, popover, freshClip, resolvedAnchor, close, { reuseShell: true });

  });



  popover.querySelector('.pc-expire-clear')?.addEventListener('click', async () => {

    const ok = await clearClipExpiry(app, clipIdKey);

    if (ok) {

      app.showToast('Expiry cleared', 'success');

      close();

    }

  });



  startCountdownTicker(popover, expiresAt, () => {

    const hint = popover.querySelector('.pc-expire-detail-hint');

    if (hint) hint.textContent = 'Expired — clip will be removed shortly.';

  });

}



function bindSetupView(app, popover, liveClip, anchorEl, close, { reuseShell = false } = {}) {

  stopExpireCountdown();



  const clipIdKey = app._clipIdKey(liveClip.id);

  const resolvedAnchor = resolveExpireAnchor(clipIdKey, anchorEl);

  if (reuseShell) positionExpirePopover(popover, resolvedAnchor);



  let selectedPreset = liveClip.expirePreset || '';

  let selectedWeekday = '';



  popover.setAttribute('role', 'dialog');

  popover.setAttribute('aria-label', 'Set clip expiry');

  popover.innerHTML = `

    <div class="pc-expire-header">

      <span class="pc-expire-title">Auto-expire</span>

      <button type="button" class="pc-expire-close" aria-label="Close expiry settings">×</button>

    </div>

    <div class="pc-expire-section">

      <div class="pc-expire-label">Presets</div>

      <div class="pc-expire-presets">${renderPresetButtons(selectedPreset)}</div>

    </div>

    <div class="pc-expire-section">

      <div class="pc-expire-label">Custom</div>

      <div class="pc-expire-custom">

        <input type="number" min="1" step="1" class="pc-expire-custom-value" data-field="customValue" placeholder="Amount" aria-label="Custom expiry amount">

        <select class="pc-expire-custom-unit" data-field="customUnit" aria-label="Custom expiry unit">

          <option value="minutes">Minutes</option>

          <option value="hours">Hours</option>

        </select>

      </div>

    </div>

    <div class="pc-expire-section">

      <div class="pc-expire-label">Target weekday (optional)</div>

      <select class="pc-expire-weekday" data-field="weekday" aria-label="Target weekday for expiry">

        ${renderWeekdayOptions(selectedWeekday)}

      </select>

    </div>

    <div class="pc-expire-error" data-field="error" hidden></div>

    <div class="pc-expire-actions">

      <button type="button" class="btn-primary pc-expire-apply">Set expiry</button>

    </div>

  `;



  window.renderLucideIcons?.();



  const errorEl = popover.querySelector('[data-field="error"]');

  const weekdayEl = popover.querySelector('[data-field="weekday"]');

  const customValueEl = popover.querySelector('[data-field="customValue"]');

  const customUnitEl = popover.querySelector('[data-field="customUnit"]');

  const presetContainer = popover.querySelector('.pc-expire-presets');



  const showError = (msg) => {

    if (!errorEl) return;

    if (!msg) {

      errorEl.hidden = true;

      errorEl.textContent = '';

      return;

    }

    errorEl.hidden = false;

    errorEl.textContent = msg;

  };



  presetContainer?.addEventListener('click', (e) => {

    const btn = e.target.closest('.pc-expire-preset');

    if (!btn) return;

    selectedPreset = btn.dataset.preset || '';

    presetContainer.querySelectorAll('.pc-expire-preset').forEach((el) => {

      el.classList.toggle('is-selected', el.dataset.preset === selectedPreset);

    });

    if (customValueEl) customValueEl.value = '';

    showError('');

  });



  const resolveDuration = () => {

    const customRaw = customValueEl?.value?.trim();

    if (customRaw) {

      const parsed = parseCustomDuration(customRaw, customUnitEl?.value || 'minutes');

      if (!parsed.ok) return parsed;

      return { ok: true, durationMs: parsed.durationMs, preset: 'custom' };

    }

    const preset = CLIP_EXPIRY_PRESETS.find((p) => p.key === selectedPreset);

    if (!preset) return { ok: false, error: 'Choose a preset or enter a custom duration' };

    return { ok: true, durationMs: preset.durationMs, preset: preset.key };

  };



  popover.querySelector('.pc-expire-close')?.addEventListener('click', close);



  popover.querySelector('.pc-expire-apply')?.addEventListener('click', async () => {

    const durationResult = resolveDuration();

    if (!durationResult.ok) {

      showError(durationResult.error);

      return;

    }

    const weekdayRaw = weekdayEl?.value;

    const weekday = weekdayRaw === '' ? null : Number(weekdayRaw);

    const expiresAt = computeExpiresAt(durationResult.durationMs, weekday);

    if (!Number.isFinite(expiresAt)) {

      showError('Could not compute expiry time');

      return;

    }

    const ok = await setClipExpiry(app, clipIdKey, expiresAt, durationResult.preset);

    if (ok) {

      app.showToast('Expiry set', 'success');

      close();

    } else {

      showError('Failed to save expiry');

    }

  });

}



export function showExpireDetailsForClip(app, clip, anchorEl, options = {}) {

  const idKey = options.clipIdKey || app._clipIdKey(typeof clip === 'object' ? clip?.id : clip);

  const liveClip = resolveClipForDisplay(app, idKey || clip);

  if (!liveClip) return;



  if (!clipHasActiveExpiry(liveClip)) {

    return showExpirePopoverForClip(app, liveClip, anchorEl, { ...options, forceSetup: true, clipIdKey: idKey });

  }



  stopExpireCountdown();

  const resolvedAnchor = resolveExpireAnchor(idKey, anchorEl);

  const { popover, close } = ensureExpireShell(resolvedAnchor, { reuse: options.reuseShell === true });

  bindDetailsView(app, popover, liveClip, resolvedAnchor, close, { reuseShell: options.reuseShell === true });

}



export function showExpirePopoverForClip(app, clip, anchorEl, options = {}) {

  if (!clip && !options.clipIdKey) return;



  const idKey = options.clipIdKey || app._clipIdKey(typeof clip === 'object' ? clip?.id : clip);

  const liveClip = resolveClipForDisplay(app, idKey || clip);

  if (!liveClip) return;



  const resolvedAnchor = resolveExpireAnchor(idKey, anchorEl);

  const canOpenDetails = options.openDetails === true && clipHasActiveExpiry(liveClip);
  const wantsSetup = options.forceSetup || !canOpenDetails;

  stopExpireCountdown();

  const { popover, close } = ensureExpireShell(resolvedAnchor, { reuse: options.reuseShell === true });



  if (wantsSetup) {

    bindSetupView(app, popover, liveClip, resolvedAnchor, close, {

      reuseShell: options.reuseShell === true,

    });

    return;

  }



  bindDetailsView(app, popover, liveClip, resolvedAnchor, close, { reuseShell: options.reuseShell === true });

}



export async function setClipExpiry(app, clipId, expiresAt, expirePreset = null) {

  const idKey = app._clipIdKey(clipId);

  if (!Number.isFinite(expiresAt)) return false;



  return app._queueClipOp(async () => {

    const location = findClipLocationById(app, idKey);

    if (!location?.clip) {

      app.showToast('Clip not found');

      return false;

    }



    const snapshot = {

      clips: PasteCraftCRUD.createSnapshot(app.clips),

      searchOnlyClips: PasteCraftCRUD.createSnapshot(app.searchOnlyClips),

    };



    const updatedAt = Date.now();

    const nextClip = {

      ...location.clip,

      expiresAt,

      expirePreset: expirePreset || null,

      updatedAt,

    };



    if (location.listName === 'clips') {

      app.clips[location.index] = nextClip;

    } else {

      app.searchOnlyClips[location.index] = nextClip;

    }

    try {

      await PasteCraftCRUD.retryOperation(async () => {

        await chrome.storage.local.set({

          [CLIPS_STORAGE_KEYS.ACTIVE]: app.clips,

          [CLIPS_STORAGE_KEYS.ARCHIVED]: app.searchOnlyClips,

          [CLIPS_STORAGE_KEYS.UPDATED_AT]: updatedAt,

        });

      });

      const syncName = location.listName === 'clips' ? 'syncClips' : 'syncArchivedClips';

      const syncData = location.listName === 'clips' ? app.clips : app.searchOnlyClips;

      const syncFn = location.listName === 'clips'

        ? pasteCraftSupabase.syncClipsToSupabase

        : pasteCraftSupabase.syncArchivedClipsToSupabase;

      Promise.resolve()

        .then(() => pasteCraftSupabase.syncWithQueue(syncName, syncData, syncFn))

        .catch(() => {});



      chrome.runtime.sendMessage({ action: 'pcScheduleClipExpiry' }).catch(() => {});

      app.renderChips();

      app.renderSearchResults();

      app.renderCategories();

      return true;

    } catch (error) {

      console.error('[clips.expire] set failed:', error);

      app.clips = snapshot.clips;

      app.searchOnlyClips = snapshot.searchOnlyClips;

      return false;

    }

  });

}



export async function clearClipExpiry(app, clipId) {

  const idKey = app._clipIdKey(clipId);



  return app._queueClipOp(async () => {

    const location = findClipLocationById(app, idKey);

    if (!location?.clip) return false;



    const snapshot = {

      clips: PasteCraftCRUD.createSnapshot(app.clips),

      searchOnlyClips: PasteCraftCRUD.createSnapshot(app.searchOnlyClips),

    };



    const updatedAt = Date.now();

    const nextClip = { ...location.clip, updatedAt };

    delete nextClip.expiresAt;

    delete nextClip.expirePreset;



    if (location.listName === 'clips') {

      app.clips[location.index] = nextClip;

    } else {

      app.searchOnlyClips[location.index] = nextClip;

    }



    try {

      await PasteCraftCRUD.retryOperation(async () => {

        await chrome.storage.local.set({

          [CLIPS_STORAGE_KEYS.ACTIVE]: app.clips,

          [CLIPS_STORAGE_KEYS.ARCHIVED]: app.searchOnlyClips,

          [CLIPS_STORAGE_KEYS.UPDATED_AT]: updatedAt,

        });

      });



      chrome.runtime.sendMessage({ action: 'pcScheduleClipExpiry' }).catch(() => {});

      app.renderChips();

      app.renderSearchResults();

      app.renderCategories();

      return true;

    } catch (error) {

      console.error('[clips.expire] clear failed:', error);

      app.clips = snapshot.clips;

      app.searchOnlyClips = snapshot.searchOnlyClips;

      return false;

    }

  });

}


