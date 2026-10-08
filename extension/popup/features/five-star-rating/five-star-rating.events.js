import {
  FIVE_STAR_CLOSE_ACTION,
  FIVE_STAR_OPEN_ACTION,
} from './five-star-rating.constants.js';

export function bindFiveStarRatingEvents({ openPanel, closePanel, isOpen }) {
  if (bindFiveStarRatingEvents._bound) return;
  bindFiveStarRatingEvents._bound = true;

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-action]')
      : null;
    if (!target) return;
    const action = target.dataset.action;
    if (action === FIVE_STAR_OPEN_ACTION) {
      event.preventDefault();
      openPanel(target);
    } else if (action === FIVE_STAR_CLOSE_ACTION) {
      event.preventDefault();
      closePanel();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    event.preventDefault();
    closePanel();
  });
}
