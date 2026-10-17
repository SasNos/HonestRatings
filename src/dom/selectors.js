// Every Google Maps selector lives here, because Google changes its markup
// without notice. Prefer ARIA roles and structure over obfuscated class names.

export const SEL = {
  ratingImage: '[role="img"][aria-label]',
  placeTitle: '[role="main"] h1',
  feed: '[role="feed"]',
  signIn: 'a[href*="accounts.google.com/ServiceLogin"]',
  tab: 'button[role="tab"]',
  sortButton: 'button[data-value="Sort"], button[aria-haspopup="true"][aria-expanded]',
  sortCandidate: 'button, [role="button"]',
  sortOption: '[role="menuitemradio"]',
  histogramRow: '[role="img"][aria-label]',
  review: '[data-review-id]',
  reviewAuthor: 'button[aria-label] > div:first-child, [class*="d4r55"]',
  reviewText: '[class*="wiI7pd"]',
};

// Sort menu entries in Google's fixed order; language independent.
export const SORT_LOWEST_INDEX = 3;

// Reviews tab label in the languages Google Maps is most used in.
export const REVIEWS_TAB = /^(review|rezension|bewertung|avis|reseña|opinion|recension|beoordeling|avalia|レビュー|评论)/i;
// Sort button label, for when the data-value attribute is missing.
export const SORT_LABEL = /sort|sortier|trier|ordenar|ordina|sorteer|classific|排序|並び/i;
