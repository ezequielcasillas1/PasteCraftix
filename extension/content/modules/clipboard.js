// PasteCraft Clipboard Utilities
// Handles clipboard read/write operations

import { saveClip } from './messaging.js';

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback to execCommand
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('[Clipboard] Copy failed:', err);
    return false;
  }
}

/**
 * Copy HTML to clipboard (with plain text fallback)
 * @param {string} html - HTML to copy
 * @param {string} plainText - Plain text fallback
 * @returns {Promise<boolean>}
 */
export async function copyHtmlToClipboard(html, plainText) {
  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob
        })
      ]);
      return true;
    }
    // Fallback to plain text
    return copyToClipboard(plainText);
  } catch (err) {
    console.error('[Clipboard] HTML copy failed:', err);
    return copyToClipboard(plainText);
  }
}

/**
 * Paste text at cursor position
 * @param {string} text - Text to paste
 * @returns {boolean} Success status
 */
export function pasteAtCursor(text) {
  const el = document.activeElement;
  if (!el) return false;

  try {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      el.value = el.value.substring(0, start) + text + el.value.substring(end);
      el.selectionStart = el.selectionEnd = start + text.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    
    if (el.isContentEditable) {
      document.execCommand('insertText', false, text);
      return true;
    }
  } catch (err) {
    console.error('[Clipboard] Paste failed:', err);
  }
  
  return false;
}

/**
 * Capture selected text from page
 * @returns {{ text: string, html: string } | null}
 */
export function getSelectedContent() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  let html = '';
  try {
    const range = selection.getRangeAt(0);
    const div = document.createElement('div');
    div.appendChild(range.cloneContents());
    html = div.innerHTML;
  } catch (_) {}

  return { text, html };
}

/**
 * Save selected text to PasteCraft
 * @param {Object} options
 * @param {string} options.category - Target category
 * @param {boolean} options.autoShow - Auto-show UI
 * @returns {Promise<boolean>}
 */
export async function saveSelectedText({ category = 'Uncategorized', autoShow = false } = {}) {
  const content = getSelectedContent();
  if (!content) return false;

  const meta = {
    kind: 'text',
    plainText: content.text,
    html: content.html,
    sourcePageUrl: window.location.href,
    capturedAt: Date.now()
  };

  const result = await saveClip({
    text: content.text,
    category,
    autoShow,
    meta
  });

  return result?.success === true;
}

/**
 * Setup auto-copy listener
 * Captures Ctrl+C / Cmd+C and saves to PasteCraft
 * @param {Object} options
 * @param {boolean} options.enabled - Enable auto-copy
 * @param {Function} options.onCapture - Callback when captured
 * @returns {Function} Cleanup function
 */
export function setupAutoCopy({ enabled = true, onCapture } = {}) {
  if (!enabled) return () => {};

  const handler = async (e) => {
    // Only capture if Ctrl+C or Cmd+C
    if (!((e.ctrlKey || e.metaKey) && e.key === 'c')) return;

    const content = getSelectedContent();
    if (!content) return;

    // Don't prevent default - let normal copy happen
    // Just also save to PasteCraft
    const meta = {
      kind: 'text',
      plainText: content.text,
      html: content.html,
      sourcePageUrl: window.location.href,
      capturedAt: Date.now()
    };

    saveClip({
      text: content.text,
      category: 'Uncategorized',
      autoShow: false,
      meta
    }).then(result => {
      if (result?.success && onCapture) {
        onCapture(content);
      }
    });
  };

  document.addEventListener('keydown', handler, true);
  return () => document.removeEventListener('keydown', handler, true);
}
