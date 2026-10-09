/**
 * Chrome Web Store listing ID. Same id as website `storeLinks.chrome`
 * and the published Chrome Web Store listing.
 */
export const CHROME_WEB_STORE_EXTENSION_ID = 'fidljmdohgkjmmgojdblbbnfoeengoko';

/** Reviews page for that listing. A 5-star rating here is the recommendation. */
export const CHROME_WEB_STORE_REVIEWS_URL =
  `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_EXTENSION_ID}/reviews`;

/** Edge Add-ons listing (same id as production-publishing-safety). */
export const EDGE_ADDONS_EXTENSION_ID = 'fblihhfoojjhmhnhilhhejdcigjmmncc';

export const EDGE_ADDONS_REVIEWS_URL =
  `https://microsoftedge.microsoft.com/addons/detail/pastecraft/${EDGE_ADDONS_EXTENSION_ID}`;

export const PASTECRAFT_SHARE_URL = 'https://pastecraft.com';

export const FIVE_STAR_HIT_CLASS = 'header-star-rating';
export const FIVE_STAR_NAV_BTN_ID = 'headerRateBtn';
export const FIVE_STAR_OPEN_ACTION = 'open-five-star-rating';
export const FIVE_STAR_CLOSE_ACTION = 'close-five-star-rating';

export const FIVE_STAR_RATE_LABEL_CHROME = 'Rate 5 stars on the Chrome Web Store';
export const FIVE_STAR_RATE_LABEL_EDGE = 'Rate 5 stars on Edge Add-ons';

/** @deprecated use resolveStoreRateLabel() */
export const FIVE_STAR_RATE_LABEL = FIVE_STAR_RATE_LABEL_CHROME;

export const FIVE_STAR_RATING_LEAD =
  'Rate PasteCraft 5 stars and help spread the good news. You can open this from the star button in the header or from the shooting-star sparkle in the background.';

export const FIVE_STAR_INCENTIVE_NOTE =
  'If you leave a 5-star store rating and share PasteCraft with someone who would benefit, you may qualify for one month on the free Basic plan. The team reviews ratings and shares manually — no card required for Basic.';

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
    title: 'Spread the good news',
    paragraphs: [
      'Tell a friend, teammate, or classmate why PasteCraft helps your clipboard workflow. Share the link to pastecraft.com or mention the extension in chat.',
      'A quick post, email, or message counts. We read store ratings and organic shares to learn who is helping the product grow.',
    ],
  },
  {
    title: 'How to leave the rating',
    steps: [
      'Choose the store button below. PasteCraft opens the Chrome Web Store or Edge Add-ons page in a new tab.',
      'Sign in on that page if the browser asks you to.',
      'Select 5 stars and publish the rating. Add a short review if you want to say why.',
      'Return to PasteCraft whenever you are done. The store keeps the rating. That published score is how we know to continue.',
    ],
  },
];
