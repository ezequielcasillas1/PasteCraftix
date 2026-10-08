/**
 * Chrome Web Store listing ID. Same id as website `storeLinks.chrome`
 * and the published Chrome Web Store listing.
 */
export const CHROME_WEB_STORE_EXTENSION_ID = 'fidljmdohgkjmmgojdblbbnfoeengoko';

/** Reviews page for that listing. A 5-star rating here is the recommendation. */
export const CHROME_WEB_STORE_REVIEWS_URL =
  `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_EXTENSION_ID}/reviews`;

export const FIVE_STAR_HIT_CLASS = 'header-star-rating';
export const FIVE_STAR_OPEN_ACTION = 'open-five-star-rating';
export const FIVE_STAR_CLOSE_ACTION = 'close-five-star-rating';

export const FIVE_STAR_RATE_LABEL = 'Rate 5 stars on the Chrome Web Store';

export const FIVE_STAR_RATING_LEAD =
  'The dithered star in the header opens this form. Use it when you want the PasteCraft team to know the product is doing a good job.';

export const FIVE_STAR_RATING_SECTIONS = [
  {
    title: 'What we are asking',
    paragraphs: [
      'Rate PasteCraft 5 stars on the Chrome Web Store. That is the public place where people decide whether to install the extension, and it is the place we read to learn whether we are doing a good job.',
      'A store rating is the signal that PasteCraft is worth continuing. We ask for 5 stars when the clipboard tools, capture, and daily use have earned that score from you.',
    ],
  },
  {
    title: 'The recommendation you give us',
    paragraphs: [
      'The recommendation is the rating itself. When you leave 5 stars, you recommend PasteCraft to the next person on the Chrome Web Store, and you recommend that the team keep building it.',
      'That rating tells us we are doing a good job. It is the recommendation we obtain from you. The written review is optional. The 5 stars are the part we treat as the recommendation.',
    ],
  },
  {
    title: 'How to leave the rating',
    steps: [
      'Choose “Rate 5 stars on the Chrome Web Store”. PasteCraft opens the reviews page in a new tab.',
      'Sign in on that page if Chrome asks you to.',
      'Select 5 stars and publish the rating. Add a short review if you want to say why.',
      'Return to PasteCraft whenever you are done. The store keeps the rating. That published score is how we know to continue.',
    ],
  },
];
