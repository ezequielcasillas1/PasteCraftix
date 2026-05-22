/**
 * Closed Shadow DOM host factory for content-script UI.
 */
export function createClosedShadowHost(fieldName = 'pc-shadow-host') {
  const host = document.createElement('div');
  host.setAttribute('data-field', fieldName);
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483645';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.pointerEvents = 'none';

  const root = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  return { host, root };
}

export function injectShadowStyles(root, cssText, fieldName = 'pc-shadow-styles') {
  const existing = root.querySelector(`[data-field="${fieldName}"]`);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.setAttribute('data-field', fieldName);
  style.textContent = cssText;
  root.appendChild(style);
}
