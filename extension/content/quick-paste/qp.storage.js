/** @forward-slice — Quick Paste chrome.storage load/save (clips, settings, position). */

import { fnv1a36 } from './qp.helpers.js';
import {
  QP_STORAGE_KEYS,
  QP_SETTINGS_LOAD_KEYS,
  QP_DEFAULTS,
  resolveQuickPasteTheme,
} from './qp.constants.js';

/**
 * Normalize one stored clip; assign legacy id when missing.
 * @returns {{ clip: object, changed: boolean }}
 */
export function normalizeStoredClip(clip, index) {
  if (!clip || typeof clip !== 'object') {
    const text = String(clip || '');
    const id = `legacy_${fnv1a36(`${text}|${index}`)}`;
    return {
      clip: { id, text, category: QP_DEFAULTS.CATEGORY, timestamp: Date.now() },
      changed: true,
    };
  }

  if (clip.id == null) {
    const text = typeof clip.text === 'string' ? clip.text : String(clip.text || '');
    const ts = typeof clip.timestamp === 'number' ? clip.timestamp : 0;
    const bucket = Math.floor(ts / 3000);
    const id = `legacy_${fnv1a36(`${text}|${bucket}|${clip.category || ''}`)}`;
    return { clip: { ...clip, id }, changed: true };
  }

  return { clip, changed: false };
}

function normalizeClipList(raw) {
  let changed = false;
  const clips = raw.map((item, i) => {
    const { clip, changed: itemChanged } = normalizeStoredClip(item, i);
    if (itemChanged) changed = true;
    return clip;
  });
  return { clips, changed };
}

async function persistRepairedClips(clips) {
  try {
    await chrome.storage.local.set({
      [QP_STORAGE_KEYS.CLIPS]: clips,
      [QP_STORAGE_KEYS.UPDATED_AT]: Date.now(),
    });
  } catch (_) {
    /* ignore persist failure — in-memory clips still usable */
  }
}

/** Load + normalize clips from chrome.storage.local. */
export async function loadQuickPasteClips() {
  try {
    console.log('🚀 DIAGNOSTIC [Quick Paste]: loadClips() called at', new Date().toISOString());
    const result = await chrome.storage.local.get([QP_STORAGE_KEYS.CLIPS]);
    const storedClips = result[QP_STORAGE_KEYS.CLIPS];
    console.log('🔍 DIAGNOSTIC [Quick Paste]: RAW storage result:', result);
    console.log('🔍 DIAGNOSTIC [Quick Paste]: Clips array exists?', !!storedClips);
    console.log('🔍 DIAGNOSTIC [Quick Paste]: Clips length:', storedClips?.length || 0);

    const raw = Array.isArray(storedClips) ? storedClips : [];
    const { clips, changed } = normalizeClipList(raw);

    console.log('✅ DIAGNOSTIC [Quick Paste]: Loaded clips count:', clips.length);

    if (changed) {
      await persistRepairedClips(clips);
    }

    if (clips.length > 0) {
      console.log('📋 First 3 clips:', clips.slice(0, 3).map((clip) => ({
        text: (clip.text || clip).substring(0, 30) + '...',
        category: clip.category || QP_DEFAULTS.CATEGORY,
        timestamp: clip.timestamp,
        fullClip: clip,
      })));
    } else {
      console.log('⚠️ DIAGNOSTIC [Quick Paste]: NO CLIPS FOUND IN STORAGE!');
    }

    return clips;
  } catch (error) {
    console.error('❌ DIAGNOSTIC [Quick Paste]: Failed to load clips:', error);
    return [];
  }
}

/**
 * Load settings + position; theme follows global storage key (dark → blue).
 * @returns {{ settings: object, position: object }}
 */
export async function loadQuickPasteSettings(currentSettings, currentPosition) {
  const settings = { ...currentSettings };
  let position = { ...currentPosition };

  try {
    const result = await chrome.storage.local.get([...QP_SETTINGS_LOAD_KEYS]);
    if (result[QP_STORAGE_KEYS.SETTINGS]) {
      Object.assign(settings, result[QP_STORAGE_KEYS.SETTINGS]);
    }
    // Single source of truth: global theme (Quick Paste follows popup)
    settings.theme = resolveQuickPasteTheme(result[QP_STORAGE_KEYS.THEME]);
    if (result[QP_STORAGE_KEYS.POSITION]) {
      position = { ...position, ...result[QP_STORAGE_KEYS.POSITION] };
    }
    console.log('⚙️ Loaded settings:', settings);
    console.log('📍 Loaded position:', position);
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return { settings, position };
}

export async function saveQuickPastePosition(position) {
  try {
    await chrome.storage.local.set({ [QP_STORAGE_KEYS.POSITION]: position });
    console.log('📍 Position saved:', position);
  } catch (error) {
    console.error('Failed to save position:', error);
  }
}

/** Persist settings without theme (theme is global / popup-controlled). */
export async function saveQuickPasteSettings(settings) {
  try {
    const { theme, ...rest } = settings || {};
    await chrome.storage.local.set({ [QP_STORAGE_KEYS.SETTINGS]: rest });
    console.log('💾 Settings saved:', rest);
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}
