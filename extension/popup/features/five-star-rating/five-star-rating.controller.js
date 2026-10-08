import {
  FIVE_STAR_HIT_CLASS,
  FIVE_STAR_OPEN_ACTION,
} from './five-star-rating.constants.js';
import { bindFiveStarRatingEvents } from './five-star-rating.events.js';
import { chromeTabsCreate, openChromeWebStoreReviews } from './five-star-rating.open-store.js';
import { createFiveStarRatingPanel } from './five-star-rating.render.js';

/** Class names owned by header.starlight.js. This slice only watches the DOM. */
const STAR_CANVAS_CLASS = 'header-starlight';
const STAR_FALLBACK_CLASS = 'header-starlight-fallback';

function syncStarHit(header) {
  const canvas = header.querySelector(`canvas.${STAR_CANVAS_CLASS}`);
  const fallback = header.querySelector(`img.${STAR_FALLBACK_CLASS}`);
  let button = header.querySelector(`button.${FIVE_STAR_HIT_CLASS}`);
  if (!canvas && !fallback) {
    button?.remove();
    return;
  }
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = FIVE_STAR_HIT_CLASS;
    button.dataset.action = FIVE_STAR_OPEN_ACTION;
    button.setAttribute('aria-label', 'Rate PasteCraft 5 stars on the Chrome Web Store');
    button.title = 'Rate PasteCraft 5 stars';
    header.append(button);
  }
  if (fallback && !canvas) {
    const headerRect = header.getBoundingClientRect();
    const imageRect = fallback.getBoundingClientRect();
    if (imageRect.width > 0 && imageRect.height > 0) {
      button.style.left = `${imageRect.left - headerRect.left + imageRect.width / 2}px`;
      button.style.top = `${imageRect.top - headerRect.top + imageRect.height / 2}px`;
    }
    return;
  }
  button.style.removeProperty('left');
  button.style.removeProperty('top');
}

export function initFiveStarRating() {
  if (initFiveStarRating._started) return;
  const header = document.querySelector('header.header');
  if (!header || !document.body) return;
  initFiveStarRating._started = true;

  const panel = createFiveStarRatingPanel(document);
  document.body.append(panel);
  let returnFocus = null;

  const openPanel = (from) => {
    returnFocus = from || document.activeElement;
    panel.hidden = false;
    panel.querySelector('[data-field="five-star-rating-submit"]')?.focus();
  };
  const closePanel = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
  };

  panel.querySelector('[data-field="five-star-rating-form"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    openChromeWebStoreReviews(chromeTabsCreate());
  });

  bindFiveStarRatingEvents({
    openPanel,
    closePanel,
    isOpen: () => !panel.hidden,
  });

  const sync = () => syncStarHit(header);
  new MutationObserver(sync).observe(header, { childList: true, subtree: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(header);
  sync();
}
