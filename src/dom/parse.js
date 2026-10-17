import { SEL } from './selectors.js';

const NUMBER = /\d+(?:[.,\u00a0\u202f]\d+)*/g;

function toInt(text) {
  return parseInt(text.replace(/\D/g, ''), 10);
}

// "4.5 stars 1,234 Reviews" / "4,5 Sterne 1.234 Rezensionen"
export function parseRatingLabel(label) {
  const numbers = (label || '').match(NUMBER);
  if (!numbers) return null;
  const average = parseFloat(numbers[0].replace(',', '.'));
  if (!(average >= 1 && average <= 5)) return null;
  return { average, total: numbers[1] ? toInt(numbers[1]) : null };
}

// "5 stars, 1,046 reviews" -> { 5: 1046 }. Rows without a count are skipped.
export function parseHistogram(root) {
  const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let rows = 0;
  for (const row of root.querySelectorAll(SEL.histogramRow)) {
    const numbers = row.getAttribute('aria-label').match(NUMBER);
    if (!numbers || numbers.length < 2) continue;
    const stars = toInt(numbers[0]);
    if (stars < 1 || stars > 5) continue;
    histogram[stars] = toInt(numbers[1]);
    rows += 1;
  }
  return rows >= 3 ? histogram : null;
}

export function parseReview(element) {
  const star = element.querySelector(SEL.ratingImage);
  const stars = star ? parseInt((star.getAttribute('aria-label') || '').match(/\d/)?.[0], 10) : NaN;
  const text = element.querySelector(SEL.reviewText)?.textContent.trim() || '';
  const author = element.querySelector(SEL.reviewAuthor)?.textContent.trim() || '';
  return { author, stars: Number.isNaN(stars) ? null : stars, text };
}

// The worst reviews that actually contain text, in the order Maps lists them
// (the list is sorted by lowest rating before this is called).
export function worstReviews(root, limit = 3) {
  return [...root.querySelectorAll(SEL.review)]
    .map(parseReview)
    .filter((review) => review.text && review.stars !== null)
    .sort((a, b) => a.stars - b.stars)
    .slice(0, limit);
}
