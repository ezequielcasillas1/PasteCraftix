import {
  CHROME_WEB_STORE_REVIEWS_URL,
  FIVE_STAR_CLOSE_ACTION,
  FIVE_STAR_RATE_LABEL,
  FIVE_STAR_RATING_LEAD,
  FIVE_STAR_RATING_SECTIONS,
} from './five-star-rating.constants.js';

function addParagraphs(doc, parent, paragraphs) {
  for (const text of paragraphs || []) {
    const paragraph = doc.createElement('p');
    paragraph.textContent = text;
    parent.append(paragraph);
  }
}

function addSteps(doc, parent, steps) {
  if (!steps?.length) return;
  const list = doc.createElement('ol');
  for (const text of steps) {
    const item = doc.createElement('li');
    item.textContent = text;
    list.append(item);
  }
  parent.append(list);
}

/** Long rating form. The submit button opens the Chrome Web Store reviews page. */
export function createFiveStarRatingPanel(doc) {
  const panel = doc.createElement('div');
  panel.className = 'five-star-rating';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Rate PasteCraft 5 stars');

  const backdrop = doc.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'five-star-rating-backdrop';
  backdrop.dataset.action = FIVE_STAR_CLOSE_ACTION;
  backdrop.setAttribute('aria-label', 'Close rating form');

  const form = doc.createElement('form');
  form.className = 'five-star-rating-form';
  form.dataset.field = 'five-star-rating-form';

  const header = doc.createElement('div');
  header.className = 'five-star-rating-header';

  const title = doc.createElement('h2');
  title.textContent = 'Rate PasteCraft 5 stars';

  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'five-star-rating-close';
  close.dataset.action = FIVE_STAR_CLOSE_ACTION;
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';

  header.append(title, close);

  const lead = doc.createElement('p');
  lead.className = 'five-star-rating-lead';
  lead.textContent = FIVE_STAR_RATING_LEAD;

  form.append(header, lead);

  for (const section of FIVE_STAR_RATING_SECTIONS) {
    const block = doc.createElement('section');
    block.className = 'five-star-rating-section';
    const heading = doc.createElement('h3');
    heading.textContent = section.title;
    block.append(heading);
    addParagraphs(doc, block, section.paragraphs);
    addSteps(doc, block, section.steps);
    form.append(block);
  }

  const destination = doc.createElement('p');
  destination.className = 'five-star-rating-url';
  destination.textContent = CHROME_WEB_STORE_REVIEWS_URL;
  form.append(destination);

  const submit = doc.createElement('button');
  submit.type = 'submit';
  submit.className = 'five-star-rating-submit';
  submit.dataset.field = 'five-star-rating-submit';
  submit.textContent = FIVE_STAR_RATE_LABEL;
  form.append(submit);

  panel.append(backdrop, form);
  return panel;
}
