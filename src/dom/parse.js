import { SEL } from './selectors.js';
import { BAD_MAX_STARS } from '../scoring.js';

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

// Five consecutive rows labelled like "5 stars, 1,046 reviews" (5 down to 1).
// The star number is found by position, so the word order of the language
// ("1.046 Rezensionen mit 5 Sternen") does not matter.
export function parseHistogram(root) {
  // Our own stars ("5 of 5 negative stars") look like histogram rows: skip them.
  const rows = [...root.querySelectorAll(SEL.histogramRow)]
    .filter((row) => !row.classList.contains('hr-stars'))
    .map((row) => (row.getAttribute('aria-label').match(NUMBER) || []).slice(0, 2).map(toInt))
    .filter((numbers) => numbers.length === 2);
  for (let start = 0; start + 5 <= rows.length; start += 1) {
    const counts = rows.slice(start, start + 5).map((numbers, k) => {
      const at = numbers.indexOf(5 - k);
      return at === -1 ? null : numbers[1 - at];
    });
    if (counts.every((count) => count !== null)) {
      return { 5: counts[0], 4: counts[1], 3: counts[2], 2: counts[3], 1: counts[4] };
    }
  }
  return null;
}

// Fallback when Maps renames the text class: the longest plain text outside buttons.
function longestText(element) {
  const texts = [...element.querySelectorAll('span, div')]
    .filter((node) => !node.children.length && !node.closest('button'))
    .map((node) => node.textContent.trim())
    .filter((text) => text.length >= 20);
  return texts.sort((a, b) => b.length - a.length)[0] || '';
}

// "1 star", "1 Stern", "Rated 1 out of 5 stars": the first number is 1-5 and
// any second number is the 5. Avatars and badges in the review are skipped.
function starsOf(element) {
  for (const image of element.querySelectorAll(SEL.ratingImage)) {
    const numbers = image.getAttribute('aria-label').match(/\d+/g);
    if (numbers && numbers[0] >= 1 && numbers[0] <= 5 && (numbers.length === 1 || numbers[1] === '5'))
      return Number(numbers[0]);
  }
  return null;
}

export function parseReview(element) {
  const stars = starsOf(element);
  const text = element.querySelector(SEL.reviewText)?.textContent.trim() || longestText(element);
  const author = element.querySelector(SEL.reviewAuthor)?.textContent.trim() || '';
  return { id: element.getAttribute('data-review-id'), author, stars, text };
}

// Maps puts data-review-id on the review and on an element inside it: take the
// outermost element of each id once.
export function reviewElements(root) {
  const seen = new Set();
  return [...root.querySelectorAll(SEL.review)].filter((element) => {
    if (element.parentElement.closest(SEL.review)) return false;
    const id = element.getAttribute('data-review-id');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Every negative review (1-2 stars), with or without text: 1 star first, then 2
// stars, each in the order Maps lists them.
export function negativeReviews(root) {
  return reviewElements(root)
    .map(parseReview)
    .filter((review) => review.stars !== null && review.stars <= BAD_MAX_STARS)
    .sort((a, b) => a.stars - b.stars);
}
