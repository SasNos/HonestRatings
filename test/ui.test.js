import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderStars } from '../src/ui/stars.js';
import { renderBadge } from '../src/ui/badge.js';
import { createChip } from '../src/ui/chip.js';
import { removeOverlay, showOverlay } from '../src/ui/overlay.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('stars and badge', () => {
  it('fills the requested number of stars', () => {
    const stars = renderStars(2);
    expect(stars.querySelectorAll('.hr-star')).toHaveLength(5);
    expect(stars.querySelectorAll('.hr-star--empty')).toHaveLength(3);
    expect(stars.getAttribute('aria-label')).toBe('2 of 5 negative stars');
  });
  it('shows exact, estimated and unknown counts', () => {
    expect(renderBadge({ stars: 1, bad: 1234, exact: true }).textContent).toBe('1,234 bad');
    expect(renderBadge({ stars: 1, bad: 12, exact: false }).textContent).toBe('~12 bad');
    expect(renderBadge({ stars: 1, bad: null, exact: false }).textContent).toBe('');
  });
});

describe('chip', () => {
  function mount() {
    const onChange = vi.fn();
    const chip = createChip(onChange);
    document.body.append(chip);
    return { chip, onChange, button: chip.querySelector('button'), menu: chip.querySelector('ul') };
  }
  it('opens in the body so the chip row cannot clip it, picks by click and closes', () => {
    const { chip, onChange, button, menu } = mount();
    expect(menu.hidden).toBe(true);
    button.click();
    expect(menu.hidden).toBe(false);
    expect(menu.parentElement).toBe(document.body);
    expect(menu.style.top).toBe('4px');
    menu.querySelectorAll('li')[3].click();
    expect(onChange).toHaveBeenCalledWith(2);
    expect(menu.hidden).toBe(true);
    expect(button.querySelectorAll('.hr-star:not(.hr-star--empty)')).toHaveLength(2);
    expect(menu.querySelectorAll('li[aria-selected="true"]')).toHaveLength(1);
    expect(chip.contains(menu)).toBe(false);
    button.click();
    button.click();
    expect(menu.hidden).toBe(true);
  });
  it('picks by keyboard and ignores other keys', () => {
    const { onChange, button, menu } = mount();
    button.click();
    const item = menu.querySelectorAll('li')[4];
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(1);
    button.click();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
  it('closes on Escape (button or menu) and on outside clicks', () => {
    const { chip, button, menu } = mount();
    button.click();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(menu.hidden).toBe(false);
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
    button.click();
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
    button.click();
    menu.click();
    expect(menu.hidden).toBe(false);
    document.body.click();
    expect(menu.hidden).toBe(true);
  });
});

describe('overlay', () => {
  const reviews = [{ author: 'Ann', stars: 1, text: 'Cold food' }, { author: '', stars: 2, text: 'Rude' }];
  it('shows the summary and the reviews and can be closed', () => {
    const panel = showOverlay({ title: 'Cafe', summary: { stars: 2, share: 0.1, bad: 5, total: 50, exact: true, average: 4.25 }, reviews });
    expect(panel.textContent).toContain('10% (5 / 50)');
    expect(panel.textContent).toContain('Google rating 4.3');
    expect(panel.querySelectorAll('.hr-review')).toHaveLength(2);
    expect(panel.textContent).toContain('Anonymous');
    panel.querySelector('.hr-overlay__close').click();
    expect(document.getElementById('hr-overlay')).toBeNull();
  });
  it('handles estimates, missing summaries, empty lists and loading', () => {
    expect(showOverlay({ title: 'A', summary: { stars: 1, share: 0.08, bad: 80, total: 1000, exact: false, average: null }, reviews: [] }).textContent).toContain('~8% (~80 / 1,000)');
    expect(showOverlay({ title: 'A', summary: { stars: 1, share: 0.025, bad: null, total: null, exact: false, average: 4.5 }, reviews: [] }).textContent).toContain('~2.5%Google rating 4.5');
    expect(showOverlay({ title: 'A', summary: { stars: 1, share: 0.05, bad: 5, total: 100, exact: true, average: null }, reviews: [] }).textContent).toContain('5% (5 / 100)');
    expect(showOverlay({ title: 'A', summary: null, reviews: [] }).textContent).toContain('No bad reviews with text found.');
    expect(showOverlay({ title: 'A', loading: true }).textContent).toContain('Loading');
  });
  it('shows a summary while loading', () => {
    const panel = showOverlay({ title: 'A', summary: { stars: 1, share: 0.05, bad: 1, total: 20, exact: true, average: null }, loading: true });
    expect(panel.textContent).toContain('5% (1 / 20)');
    expect(panel.textContent).toContain('Loading');
  });
  it('explains what it found when no reviews were read, but not when signed out', () => {
    const debug = { sort: true, options: 4, reviewElements: 0, histogram: { 5: 9, 4: 8, 3: 7, 2: 6, 1: 5 } };
    expect(showOverlay({ title: 'A', reviews: [], debug }).textContent).toContain('Debug: sort button found, 4 menu items, 0 review elements');
    expect(showOverlay({ title: 'A', reviews: [], debug }).textContent).toContain('histogram 5:9 4:8 3:7 2:6 1:5');
    expect(showOverlay({ title: 'A', reviews: [], debug: { ...debug, sort: false, histogram: null } }).textContent).toContain('sort button missing, 4 menu items, 0 review elements, histogram not found');
    expect(showOverlay({ title: 'A', reviews: [], debug, signedOut: true }).textContent).not.toContain('Debug');
    expect(showOverlay({ title: 'A', reviews: [{ author: 'x', stars: 1, text: 't' }], debug }).textContent).not.toContain('Debug');
  });
  it('asks to sign in when signed out', () => {
    expect(showOverlay({ title: 'A', reviews: [], signedOut: true }).textContent).toContain('Sign in to Google Maps');
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
