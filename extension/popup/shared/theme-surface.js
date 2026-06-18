/** Global popup theme — class on <html> for CSS; Quick Paste reads chrome.storage `theme`. */

export const POPUP_THEME_DARK_CLASS = 'pastecraft-theme-dark';

export function normalizeTheme(raw) {
  return raw === 'dark' ? 'dark' : 'light';
}

export function applyPopupTheme(theme) {
  const root = document.documentElement;
  if (!root) return;
  const isDark = normalizeTheme(theme) === 'dark';
  root.classList.toggle(POPUP_THEME_DARK_CLASS, isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}
