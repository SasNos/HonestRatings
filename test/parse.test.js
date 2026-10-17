import { describe, expect, it } from 'vitest';
import { parseHistogram, parseRatingLabel, parseReview, reviewElements, negativeReviews } from '../src/dom/parse.js';

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
  it('finds the star by position, whatever the word order of the language', () => {
    const root = html([5, 4, 3, 2, 1].map((s) => row(`${s * 100 + 7} Rezensionen mit ${s} Sternen`)).join(''));
    expect(parseHistogram(root)).toEqual({ 1: 107, 2: 207, 3: 307, 4: 407, 5: 507 });
  });
  it('never reads its own stars as a histogram', () => {
    const own = [5, 4, 3, 2, 1].map((s) => `<span class="hr-stars" role="img" aria-label="${s} of 5 negative stars"></span>`).join('');
    expect(parseHistogram(html(own))).toBeNull();
  });
  it('accepts equal star and count numbers', () => {
    const root = html([5, 4, 3, 2, 1].map((s) => row(`${s} stars, ${s} reviews`)).join(''));
    expect(parseHistogram(root)).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
  });
  it('skips unrelated rows in front and returns null without a full run', () => {
    const noise = `<div role="img"></div>${row('Photo')}${row('4.0 stars 500 Reviews')}`;
    const full = [5, 4, 3, 2, 1].map((s) => row(`${s} stars, ${s * 10} reviews`)).join('');
    expect(parseHistogram(html(noise + full))[5]).toBe(50);
    expect(parseHistogram(html(noise + row('5 stars, 4 reviews') + row('4 stars, 3 reviews')))).toBeNull();
    expect(parseHistogram(html(noise + row('5 stars, 4 reviews') + row('3 stars, 3 reviews') + row('3 stars, 3 reviews') + row('2 stars, 1 review') + row('1 star, 1 review')))).toBeNull();
  });
});

describe('reviews', () => {
  let next = 0;
  const review = (stars, text, author = 'Ann') =>
    `<div data-review-id="r${(next += 1)}"><div class="d4r55">${author}</div><span role="img" aria-label="${stars} stars"></span><span class="wiI7pd">${text}</span></div>`;
  it('parses author, stars and text', () => {
    const element = html(review(1, ' Awful ')).firstChild;
    expect(parseReview(element)).toEqual({ author: 'Ann', stars: 1, text: 'Awful' });
  });
  it('tolerates missing parts', () => {
    expect(parseReview(html('<div></div>').firstChild)).toEqual({ author: '', stars: null, text: '' });
    expect(parseReview(html('<div><span role="img" aria-label="stars"></span></div>').firstChild).stars).toBeNull();
    expect(parseReview(html('<div><span role="img" aria-label=""></span></div>').firstChild).stars).toBeNull();
  });
  it('finds the stars among other images in the review', () => {
    const avatar = '<img role="img" aria-label="Photo of Ann">';
    const guide = '<span role="img" aria-label="Local Guide"></span>';
    const mk = (label) => html(`<div>${avatar}${guide}<span role="img" aria-label="${label}"></span></div>`).firstChild;
    expect(parseReview(mk('1 star')).stars).toBe(1);
    expect(parseReview(mk('Mit 2 von 5 Sternen bewertet')).stars).toBe(2);
    expect(parseReview(mk('Rated 3 out of 5')).stars).toBe(3);
    expect(parseReview(mk('9 stars')).stars).toBeNull();
    expect(parseReview(mk('2 of 7')).stars).toBeNull();
    expect(parseReview(mk('0 stars')).stars).toBeNull();
  });
  it('falls back to the longest plain text when the text class is gone', () => {
    const element = html('<div><button>A very long button label that must not count</button><span>short</span><span>The staff ignored us for an hour.</span><div>Shorter sentence here.</div></div>').firstChild;
    expect(parseReview(element).text).toBe('The staff ignored us for an hour.');
    expect(parseReview(html('<div><span>short</span></div>').firstChild).text).toBe('');
  });
  it('counts a review once although Maps repeats its id on an inner element and on siblings', () => {
    const nested = '<div data-review-id="a"><div data-review-id="a"><span role="img" aria-label="1 star"></span><span class="wiI7pd">Awful</span></div></div>';
    const sibling = '<div data-review-id="a"><span role="img" aria-label="1 star"></span><span class="wiI7pd">Awful</span></div>';
    const other = '<div data-review-id="b"><span role="img" aria-label="2 stars"></span><span class="wiI7pd">Bad</span></div>';
    const root = html(nested + sibling + other);
    expect(reviewElements(root)).toHaveLength(2);
    expect(negativeReviews(root).map((r) => r.text)).toEqual(['Awful', 'Bad']);
  });
  it('lists every negative review with text, worst first, and nothing above 2 stars', () => {
    const root = html(review(2, 'b') + review(1, '') + review(1, 'a') + review(3, 'c') + review(1, 'd') + review(5, 'e') + '<div data-review-id="y"></div>');
    expect(negativeReviews(root).map((r) => r.text)).toEqual(['a', 'd', 'b']);
  });
});
