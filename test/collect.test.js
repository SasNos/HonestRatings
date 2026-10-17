import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collect, findReviewsTab, findSort, revealReview, waitFor } from '../src/dom/collect.js';

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

describe('findSort', () => {
  it('finds the button by data-value, by label in any language, or not at all', () => {
    document.body.innerHTML = '<button data-value="Sort"></button>';
    expect(findSort(document)).not.toBeNull();
    document.body.innerHTML = '<button aria-label="Rezensionen sortieren"></button>';
    expect(findSort(document)).not.toBeNull();
    document.body.innerHTML = '<div role="button">Sortieren</div>';
    expect(findSort(document)).not.toBeNull();
    document.body.innerHTML = '<button aria-label="Share"></button>';
    expect(findSort(document)).toBeNull();
  });
});

describe('loading more reviews', () => {
  function scrollingPanel(onLoad) {
    panel();
    Object.defineProperty(document.body, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(document.body, 'clientHeight', { value: 10, configurable: true });
    const state = { loads: 0 };
    Object.defineProperty(document.body, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set(value) {
        if (value > 0) {
          state.loads += 1;
          onLoad(state.loads, document.getElementById('area'));
        }
      },
    });
    return state;
  }
  const review = (id, stars, text) => `<div data-review-id="${id}"><span role="img" aria-label="${stars} stars"></span><span class="wiI7pd">${text}</span></div>`;
  afterEach(() => {
    delete document.body.scrollHeight;
    delete document.body.clientHeight;
    delete document.body.scrollTop;
  });

  it('keeps scrolling until a review above the bad ones shows up', async () => {
    const state = scrollingPanel((count, area) => {
      area.insertAdjacentHTML('beforeend', count === 1 ? review('s', 2, 'Second') : review('t', 4, 'Fine'));
    });
    const result = await collect(document, FAST);
    expect(state.loads).toBe(2);
    expect(result.reviews.map((r) => r.text)).toEqual(['Bad', 'Second']);
  });
  it('stops when nothing new arrives', async () => {
    const state = scrollingPanel(() => {});
    const result = await collect(document, FAST);
    expect(state.loads).toBe(1);
    expect(result.reviews.map((r) => r.text)).toEqual(['Bad']);
  });
  it('gives up after the maximum number of loads', async () => {
    const state = scrollingPanel((count, area) => area.insertAdjacentHTML('beforeend', review(`m${count}`, 1, `More ${count}`)));
    const result = await collect(document, FAST);
    expect(state.loads).toBe(30);
    expect(result.reviews).toHaveLength(31);
  });
  it('scrolls once and gives up when no review element is on the page at all', async () => {
    const state = scrollingPanel(() => {});
    document.getElementById('area').addEventListener('click', () => {});
    document.querySelectorAll('button[role="tab"]')[1].replaceWith(document.querySelectorAll('button[role="tab"]')[1].cloneNode(true));
    const result = await collect(document, FAST);
    expect(result.reviews).toEqual([]);
    expect(state.loads).toBe(1);
  });
  it('does not scroll when there is no scrollable panel', async () => {
    panel();
    const result = await collect(document, FAST);
    expect(result.reviews.map((r) => r.text)).toEqual(['Bad']);
  });
});

describe('collect progress', () => {
  it('reports the negative reviews found so far', async () => {
    panel();
    const seen = [];
    await collect(document, FAST, (reviews) => seen.push(reviews.map((r) => r.text)));
    expect(seen.at(0)).toEqual(['Bad']);
  });
});

describe('revealReview', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    delete window.HTMLElement.prototype.scrollIntoView;
    delete document.body.scrollHeight;
    delete document.body.clientHeight;
    delete document.body.scrollTop;
  });

  it('opens the reviews tab, sorts, scrolls the review into view and flashes it', async () => {
    panel();
    expect(await revealReview(document, 'r', FAST)).toBe(true);
    const element = document.querySelector('[data-review-id="r"]');
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(element.classList.contains('hr-flash')).toBe(true);
    await vi.waitFor(() => expect(element.classList.contains('hr-flash')).toBe(false), { timeout: 4000 });
  });
  it('flashes a review that is already on the page without touching the tabs', async () => {
    const clicks = panel();
    document.getElementById('area').innerHTML = '<div data-review-id="here"><span role="img" aria-label="1 star"></span></div>';
    expect(await revealReview(document, 'here', FAST)).toBe(true);
    expect(clicks).toEqual([]);
  });
  it('gives up without a reviews tab, for an unknown review, and signed out', async () => {
    panel({ withTabs: false });
    expect(await revealReview(document, 'r', FAST)).toBe(false);
    panel();
    expect(await revealReview(document, 'unknown', FAST)).toBe(false);
    panel();
    document.body.insertAdjacentHTML('beforeend', '<a href="https://accounts.google.com/ServiceLogin">Sign in</a>');
    expect(await revealReview(document, 'r', FAST)).toBe(false);
  });
  it('uses default options and scrolls to load the review when it is not there yet', async () => {
    panel();
    Object.defineProperty(document.body, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(document.body, 'clientHeight', { value: 10, configurable: true });
    let loads = 0;
    Object.defineProperty(document.body, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set(value) {
        if (value > 0) {
          loads += 1;
          if (loads === 2) document.getElementById('area').insertAdjacentHTML('beforeend', '<div data-review-id="late"><span role="img" aria-label="2 stars"></span></div>');
          else document.getElementById('area').insertAdjacentHTML('beforeend', `<div data-review-id="filler${loads}"><span role="img" aria-label="1 star"></span></div>`);
        }
      },
    });
    expect(await revealReview(document, 'late')).toBe(true);
    expect(loads).toBe(2);
  });
});

describe('collect', () => {
  it('still reads the loaded reviews when there is no sort button', async () => {
    panel({ sort: false });
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      document.getElementById('area').insertAdjacentHTML('beforeend', '<div data-review-id="a"><span role="img" aria-label="2 stars"></span><span class="wiI7pd">Meh</span></div>');
    });
    const result = await collect(document, FAST);
    expect(result.reviews.map((r) => r.text)).toEqual(['Meh']);
    expect(result.debug.sort).toBe(false);
  });
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
  it('reports debug numbers and presses the whole pointer sequence', async () => {
    const seen = [];
    panel();
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      document.getElementById('area').addEventListener('mousedown', (event) => seen.push(event.target.getAttribute('data-value') || event.target.getAttribute('role')));
    });
    const result = await collect(document, FAST);
    expect(seen).toEqual(['Sort', 'menuitemradio']);
    expect(result.debug).toMatchObject({ sort: true, options: 4, reviewElements: 1 });
    expect(result.debug.histogram[5]).toBe(5);
  });
  it('waits until the list changes after choosing the sort order', async () => {
    panel();
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      document.getElementById('area').insertAdjacentHTML('beforeend', '<div data-review-id="old"><span role="img" aria-label="1 star"></span><span class="wiI7pd">Early</span></div>');
      setTimeout(() => {
        document.querySelector('[data-review-id="old"]')?.setAttribute('data-review-id', 'new');
      }, 0);
    });
    document.body.addEventListener('click', (event) => {
      if (event.target.id === 'o3') document.querySelector('[data-review-id="old"], [data-review-id="new"]')?.setAttribute('data-review-id', 'new2');
    });
    const result = await collect(document, FAST);
    expect(result.reviews.map((r) => r.text)).toContain('Early');
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
