import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collect, findReviewsTab, waitFor } from '../src/dom/collect.js';

const FAST = { timeout: 50, interval: 5, settle: 0, restore: 0 };

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => vi.useRealTimers());

function panel({ sort = true, options = true, withTabs = true } = {}) {
  const tab = (label, selected) => `<button role="tab" aria-label="${label}" aria-selected="${selected}"></button>`;
  document.body.innerHTML = `${withTabs ? tab('Overview', true) + tab('Reviews', false) : tab('About', true)}<div id="area"></div>`;
  const area = document.getElementById('area');
  const [overview, reviews] = document.querySelectorAll('button[role="tab"]');
  const clicks = [];
  reviews?.addEventListener('click', () => {
    clicks.push('reviews');
    area.innerHTML = [5, 4, 3, 2, 1].map((s) => `<div role="img" aria-label="${s} stars, ${s} reviews"></div>`).join('');
    if (sort) {
      area.insertAdjacentHTML('beforeend', '<button data-value="Sort"></button>');
      area.querySelector('button').addEventListener('click', () => {
        clicks.push('sort');
        if (options) {
          area.insertAdjacentHTML('beforeend', [0, 1, 2, 3].map((i) => `<div role="menuitemradio" id="o${i}"></div>`).join(''));
          document.getElementById('o3').addEventListener('click', () => {
            clicks.push('lowest');
            area.insertAdjacentHTML('beforeend', '<div data-review-id="r"><span role="img" aria-label="1 star"></span><span class="wiI7pd">Bad</span></div>');
          });
        }
      });
    }
  });
  overview?.addEventListener('click', () => clicks.push('overview'));
  return clicks;
}

describe('waitFor', () => {
  it('resolves immediately, later, and with null on timeout', async () => {
    expect(await waitFor(() => 'now')).toBe('now');
    let calls = 0;
    expect(await waitFor(() => (++calls > 2 ? 'later' : null), FAST)).toBe('later');
    expect(await waitFor(() => null, { timeout: 20, interval: 5 })).toBeNull();
  });
  it('uses its defaults', async () => {
    vi.useFakeTimers();
    const pending = waitFor(() => null);
    await vi.advanceTimersByTimeAsync(4100);
    expect(await pending).toBeNull();
  });
});

describe('findReviewsTab', () => {
  it('matches by label or text and returns null without a match', () => {
    document.body.innerHTML = '<button role="tab">Rezensionen</button>';
    expect(findReviewsTab(document)).not.toBeNull();
    document.body.innerHTML = '<button role="tab">About</button>';
    expect(findReviewsTab(document)).toBeNull();
  });
});

describe('collect', () => {
  it('walks tab, sort and lowest option, then restores the overview', async () => {
    const clicks = panel();
    const result = await collect(document, FAST);
    expect(clicks).toEqual(['reviews', 'sort', 'lowest', 'overview']);
    expect(result.histogram[5]).toBe(5);
    expect(result.reviews).toHaveLength(1);
  });
  it('restores the scroll position of the panel after the tab switch', async () => {
    panel();
    Object.defineProperty(document.body, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(document.body, 'clientHeight', { value: 10, configurable: true });
    document.body.scrollTop = 40;
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      document.body.scrollTop = 0;
    });
    await collect(document, FAST);
    expect(document.body.scrollTop).toBe(40);
    delete document.body.scrollHeight;
    delete document.body.clientHeight;
  });
  it('uses default options', async () => {
    panel();
    Object.defineProperty(document.body, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(document.body, 'clientHeight', { value: 10, configurable: true });
    expect((await collect(document)).reviews).toHaveLength(1);
    delete document.body.scrollHeight;
    delete document.body.clientHeight;
  });
  it('returns no reviews when the sort button or the menu is missing', async () => {
    panel({ sort: false });
    expect((await collect(document, FAST)).reviews).toEqual([]);
    panel({ options: false });
    expect((await collect(document, FAST)).reviews).toEqual([]);
  });
  it('does not sort when signed out, because Maps would show a sign-in dialog', async () => {
    const clicks = panel();
    document.body.insertAdjacentHTML('beforeend', '<a href="https://accounts.google.com/ServiceLogin?hl=en">Sign in</a>');
    const result = await collect(document, FAST);
    expect(clicks).not.toContain('sort');
    expect(result).toMatchObject({ reviews: [], signedOut: true });
  });
  it('matches only tabs that start with the reviews word', () => {
    document.body.innerHTML = '<button role="tab" aria-label="Overview of Review Cafe"></button>';
    expect(findReviewsTab(document)).toBeNull();
  });
  it('gives up without a reviews tab', async () => {
    panel({ withTabs: false });
    expect(await collect(document, FAST)).toBeNull();
  });
  it('does not click back when the reviews tab was already open', async () => {
    const clicks = panel();
    const tabs = document.querySelectorAll('button[role="tab"]');
    tabs[0].setAttribute('aria-selected', 'false');
    tabs[1].setAttribute('aria-selected', 'true');
    await collect(document, FAST);
    expect(clicks).not.toContain('overview');
  });
  it('copes with no tab being marked selected', async () => {
    const clicks = panel();
    document.querySelectorAll('button[role="tab"]')[0].setAttribute('aria-selected', 'false');
    await collect(document, FAST);
    expect(clicks).not.toContain('overview');
  });
});
