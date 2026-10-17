import { describe, expect, it } from 'vitest';
import { parseHistogram, parseRatingLabel, parseReview, worstReviews } from '../src/dom/parse.js';

function html(markup) {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
}

describe('parseRatingLabel', () => {
  it('reads English and German labels', () => {
    expect(parseRatingLabel('4.5 stars 1,234 Reviews')).toEqual({ average: 4.5, total: 1234 });
    expect(parseRatingLabel('4,5 Sterne 1.234 Rezensionen')).toEqual({ average: 4.5, total: 1234 });
  });
  it('allows a missing total', () => {
    expect(parseRatingLabel('4.0 stars')).toEqual({ average: 4, total: null });
  });
  it('rejects anything that is not a rating', () => {
    expect(parseRatingLabel(null)).toBeNull();
    expect(parseRatingLabel('no number')).toBeNull();
    expect(parseRatingLabel('120 meters')).toBeNull();
  });
});

describe('parseHistogram', () => {
  const row = (label) => `<div role="img" aria-label="${label}"></div>`;
  it('reads the five rows', () => {
    const root = html([5, 4, 3, 2, 1].map((s) => row(`${s} stars, ${s * 1000} reviews`)).join(''));
    expect(parseHistogram(root)).toEqual({ 1: 1000, 2: 2000, 3: 3000, 4: 4000, 5: 5000 });
  });
  it('ignores unrelated and malformed rows and needs at least three', () => {
    const root = html(`<div role="img"></div>${row('Photo')}${row('0 stars, 4 reviews')}${row('9 stars, 4 reviews')}${row('5 stars, 4 reviews')}${row('4 stars, 3 reviews')}`);
    expect(parseHistogram(root)).toBeNull();
  });
});

describe('reviews', () => {
  const review = (stars, text, author = 'Ann') =>
    `<div data-review-id="x"><div class="d4r55">${author}</div><span role="img" aria-label="${stars} stars"></span><span class="wiI7pd">${text}</span></div>`;
  it('parses author, stars and text', () => {
    const element = html(review(1, ' Awful ')).firstChild;
    expect(parseReview(element)).toEqual({ author: 'Ann', stars: 1, text: 'Awful' });
  });
  it('tolerates missing parts', () => {
    expect(parseReview(html('<div></div>').firstChild)).toEqual({ author: '', stars: null, text: '' });
    expect(parseReview(html('<div><span role="img" aria-label="stars"></span></div>').firstChild).stars).toBeNull();
    expect(parseReview(html('<div><span role="img" aria-label=""></span></div>').firstChild).stars).toBeNull();
  });
  it('picks the worst reviews that have text', () => {
    const root = html(review(2, 'b') + review(1, '') + review(1, 'a') + review(3, 'c') + review(1, 'd') + '<div data-review-id="y"></div>');
    expect(worstReviews(root).map((r) => r.text)).toEqual(['a', 'd', 'b']);
    expect(worstReviews(root, 1)).toHaveLength(1);
  });
});
