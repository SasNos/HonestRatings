import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderStars } from '../src/ui/stars.js';
import { removeOverlay, showOverlay } from '../src/ui/overlay.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('stars', () => {
  it('fills the requested number of stars', () => {
    const stars = renderStars(2);
    expect(stars.querySelectorAll('.hr-star')).toHaveLength(5);
    expect(stars.querySelectorAll('.hr-star--empty')).toHaveLength(3);
    expect(stars.getAttribute('aria-label')).toBe('2 of 5 negative stars');
  });
});

describe('overlay', () => {
  const reviews = [{ author: 'Ann', stars: 1, text: 'Cold food' }, { author: '', stars: 2, text: 'Rude' }];
  it('shows the summary and the reviews and can be closed', () => {
    const panel = showOverlay({ title: 'Cafe', summary: { stars: 2, share: 0.1, bad: 5, total: 50, exact: true, average: 4.25 }, reviews });
    expect(panel.textContent).toContain('10% (5 / 50)');
    expect(panel.textContent).toContain('Google rating 4.3');
    expect(panel.querySelectorAll('.hr-review')).toHaveLength(2);
    expect(panel.textContent).toContain('2 negative reviews (1-2 stars), 1 star first');
    expect(panel.textContent).toContain('Anonymous');
    panel.querySelector('.hr-overlay__close').click();
    expect(document.getElementById('hr-overlay')).toBeNull();
  });
  it('handles estimates, missing summaries, empty lists and loading', () => {
    expect(showOverlay({ title: 'A', summary: { stars: 1, share: 0.08, bad: 80, total: 1000, exact: false, average: null }, reviews: [] }).textContent).toContain('~8% (~80 / 1,000)');
    expect(showOverlay({ title: 'A', summary: { stars: 1, share: 0.025, bad: null, total: null, exact: false, average: 4.5 }, reviews: [] }).textContent).toContain('~2.5%Google rating 4.5');
    expect(showOverlay({ title: 'A', summary: { stars: 1, share: 0.05, bad: 5, total: 100, exact: true, average: null }, reviews: [] }).textContent).toContain('5% (5 / 100)');
    expect(showOverlay({ title: 'A', summary: null, reviews: [] }).textContent).toContain('No negative reviews found.');
    expect(showOverlay({ title: 'A', loading: true }).textContent).toContain('Loading the negative reviews');
  });
  it('shows a summary while loading', () => {
    const panel = showOverlay({ title: 'A', summary: { stars: 1, share: 0.05, bad: 1, total: 20, exact: true, average: null }, loading: true });
    expect(panel.textContent).toContain('5% (1 / 20)');
    expect(panel.textContent).toContain('Loading the negative reviews');
  });
  it('explains what it found when no reviews were read, but not when signed out', () => {
    const debug = { sort: true, options: 4, reviewElements: 0, histogram: { 5: 9, 4: 8, 3: 7, 2: 6, 1: 5 } };
    expect(showOverlay({ title: 'A', reviews: [], debug }).textContent).toContain('Debug: sort button found, 4 menu items, 0 review elements');
    expect(showOverlay({ title: 'A', reviews: [], debug }).textContent).toContain('histogram 5:9 4:8 3:7 2:6 1:5');
    expect(showOverlay({ title: 'A', reviews: [], debug: { ...debug, sort: false, histogram: null } }).textContent).toContain('sort button missing, 4 menu items, 0 review elements, histogram not found');
    expect(showOverlay({ title: 'A', reviews: [], debug, signedOut: true }).textContent).not.toContain('Debug');
    expect(showOverlay({ title: 'A', reviews: [{ author: 'x', stars: 1, text: 't' }], debug }).textContent).not.toContain('Debug');
    expect(showOverlay({ title: 'A', reviews: [{ author: 'x', stars: 1, text: 't' }] }).textContent).toContain('1 negative review (1-2 stars), 1 star first');
  });
  it('asks to sign in when signed out', () => {
    expect(showOverlay({ title: 'A', reviews: [], signedOut: true }).textContent).toContain('Sign in to Google Maps');
  });
  it('opens a review on click, Enter or Space and ignores other keys', () => {
    const onReview = vi.fn();
    const panel = showOverlay({ title: 'Cafe', reviews: [{ id: 'a', author: 'Ann', stars: 1, text: 'Cold' }], onReview });
    const card = panel.querySelector('.hr-review');
    card.click();
    expect(onReview).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(onReview).toHaveBeenCalledTimes(1);
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onReview).toHaveBeenCalledTimes(3);
    expect(card.getAttribute('role')).toBe('button');
  });
  it('works without an onReview handler and shows reviews without text', () => {
    const panel = showOverlay({ title: 'Cafe', reviews: [{ id: 'a', author: 'Ann', stars: 2, text: '' }] });
    panel.querySelector('.hr-review').click();
    expect(panel.querySelector('.hr-review__text--empty').textContent).toBe('No text');
  });
  it('shows reviews that are loaded so far while it still loads, and keeps the scroll position', () => {
    const first = showOverlay({ title: 'Cafe', reviews: [], loading: true });
    first.scrollTop = 40;
    const again = showOverlay({ title: 'Cafe', reviews: [{ id: 'a', author: 'Ann', stars: 1, text: 'Cold' }], loading: true });
    expect(again.textContent).toContain('Loading the negative reviews');
    expect(again.textContent).toContain('1 negative review');
    expect(again.scrollTop).toBe(40);
  });
  it('replaces the previous overlay and can remove it', () => {
    showOverlay({ title: 'A', reviews: [] });
    showOverlay({ title: 'B', reviews: [] });
    expect(document.querySelectorAll('#hr-overlay')).toHaveLength(1);
    removeOverlay();
    expect(document.getElementById('hr-overlay')).toBeNull();
    removeOverlay();
  });
});
