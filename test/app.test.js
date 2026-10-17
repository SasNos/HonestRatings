import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, start } from '../src/app.js';

const FAST = { timeout: 30, interval: 5, settle: 0 };

function card(label = '4.0 stars 1,000 Reviews') {
  return `<div role="article"><span role="img" aria-label="${label}">4.0</span></div>`;
}

function results(...cards) {
  document.body.innerHTML = `<button>Rating</button><div role="feed">${cards.join('')}</div>`;
}

beforeEach(() => {
  document.body.innerHTML = '';
  // jsdom has no layout: report every element as rendered unless a test says otherwise.
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('result cards', () => {
  it('replaces the rating with a badge once and keeps it on rescans', () => {
    results(card(), card('2.0 stars 100 Reviews'), '<div role="article"><span role="img" aria-label="Photo"></span></div>');
    const app = createApp(document, FAST);
    app.scan();
    app.scan();
    const badges = document.querySelectorAll('[data-hr-badge]');
    expect(badges).toHaveLength(2);
    expect(badges[0].textContent).toBe('~80 bad');
    expect(document.querySelectorAll('[data-hr-hidden]')).toHaveLength(2);
  });
  it('never mistakes its own stars for a rating, even when Maps removes the original', () => {
    results(card());
    const app = createApp(document, FAST);
    app.scan();
    document.querySelector('[data-hr-hidden]').remove();
    app.scan();
    expect(document.querySelector('[role="article"]').hasAttribute('data-hr-filtered')).toBe(false);
    expect(document.querySelector('[data-hr-badge]').dataset.hrStars).toBe('1');
  });
  it('rebuilds the badge when Maps reuses a card for another place', () => {
    results(card());
    const app = createApp(document, FAST);
    app.scan();
    const rating = document.querySelector('[data-hr-hidden]');
    rating.setAttribute('aria-label', '2.5 stars 100 Reviews');
    app.scan();
    expect(document.querySelectorAll('[data-hr-badge]')).toHaveLength(1);
    expect(document.querySelector('[data-hr-badge]').dataset.hrStars).toBe('5');
    app.scan();
    expect(document.querySelectorAll('[data-hr-badge]')).toHaveLength(1);
  });
  it('never mistakes its own stars for a rating, even when Maps removes the original', () => {
    results(card());
    const app = createApp(document, FAST);
    app.scan();
    document.querySelector('[data-hr-hidden]').remove();
    app.scan();
    expect(document.querySelector('[role="article"]').hasAttribute('data-hr-filtered')).toBe(false);
    expect(document.querySelector('[data-hr-badge]').dataset.hrStars).toBe('1');
  });
  it('rebuilds the badge when Maps reuses a card for another place', () => {
    results(card());
    const app = createApp(document, FAST);
    app.scan();
    document.querySelector('[data-hr-hidden]').setAttribute('aria-label', '2.5 stars 100 Reviews');
    app.scan();
    expect(document.querySelectorAll('[data-hr-badge]')).toHaveLength(1);
    expect(document.querySelector('[data-hr-badge]').dataset.hrStars).toBe('5');
    app.scan();
    expect(document.querySelectorAll('[data-hr-badge]')).toHaveLength(1);
  });
});

describe('rating menu', () => {
  const ratingMenu = `<div role="menu" aria-label="Rating"><div id="list">
    <div role="menuitemradio" aria-checked="true"><div>Any rating</div></div>
    <div role="menuitemradio" aria-checked="false"><span aria-label="2.0 stars"></span></div></div></div>`;

  function page() {
    document.body.innerHTML = `${ratingMenu}<div role="menu" aria-label="Sort"><div><div role="menuitemradio">Newest</div></div></div><div role="feed">${card()}${card('2.0 stars 100 Reviews')}</div>`;
    const escapes = vi.fn();
    const anyClicks = vi.fn();
    document.querySelector('[aria-label="Rating"]').addEventListener('keydown', (event) => event.key === 'Escape' && escapes());
    document.querySelector('#list [role="menuitemradio"]').addEventListener('click', anyClicks);
    return { escapes, anyClicks };
  }
  const html = document.documentElement;

  it('adds the Negative section to the rating menu only, once', () => {
    page();
    const app = createApp(document, FAST);
    app.scan();
    app.scan();
    expect(document.querySelectorAll('.hr-menu-section')).toHaveLength(1);
    expect(document.getElementById('list').lastElementChild.className).toBe('hr-menu-section');
    expect([...document.querySelectorAll('.hr-menu-item')].some((row) => row.getAttribute('aria-checked') === 'true')).toBe(false);
  });
  it('filters by at least N negative stars, resets the Maps filter and closes the menu', () => {
    const { escapes, anyClicks } = page();
    const app = createApp(document, FAST);
    app.scan();
    const rows = document.querySelectorAll('.hr-menu-item');
    // card 1: 4.0 on Google = 1 negative star, card 2: 2.0 on Google = 5 negative stars
    rows[1].click();
    const cards = document.querySelectorAll('[role="article"]');
    expect(cards[0].hasAttribute('data-hr-filtered')).toBe(true);
    expect(cards[1].hasAttribute('data-hr-filtered')).toBe(false);
    expect(anyClicks).toHaveBeenCalledTimes(1);
    expect(escapes).toHaveBeenCalledTimes(1);
    // our own click on "Any rating" must not leave the negative view
    expect(html.hasAttribute('data-hr-negative')).toBe(true);
    rows[4].click();
    expect(cards[1].hasAttribute('data-hr-filtered')).toBe(false);
    rows[0].click();
    expect(cards[0].hasAttribute('data-hr-filtered')).toBe(false);
    expect(html.hasAttribute('data-hr-negative')).toBe(true);
  });
  it('leaves the negative view when a Maps option is picked, and not for our own rows', () => {
    page();
    const app = createApp(document, FAST);
    app.scan();
    expect(html.hasAttribute('data-hr-negative')).toBe(false);
    document.querySelectorAll('.hr-menu-item')[0].click();
    expect(html.hasAttribute('data-hr-negative')).toBe(true);
    document.querySelector('.hr-menu-heading').click();
    expect(html.hasAttribute('data-hr-negative')).toBe(true);
    document.querySelector('[aria-label="Rating"]').click();
    expect(html.hasAttribute('data-hr-negative')).toBe(true);
    document.querySelectorAll('#list > [role="menuitemradio"]')[1].click();
    expect(html.hasAttribute('data-hr-negative')).toBe(false);
  });
  it('turns a Maps rating option into an exact band instead of "or higher"', () => {
    page();
    const app = createApp(document, FAST, 0);
    app.scan();
    const cards = document.querySelectorAll('[role="article"]');
    const items = document.querySelectorAll('#list > [role="menuitemradio"]');
    items[1].click(); // "2.0 stars": 2.0 to 2.4
    expect(cards[0].hasAttribute('data-hr-filtered')).toBe(true); // 4.0 is above the band
    expect(cards[1].hasAttribute('data-hr-filtered')).toBe(false); // 2.0 is inside
    items[0].click(); // Any rating
    expect(cards[0].hasAttribute('data-hr-filtered')).toBe(false);
    expect(cards[1].hasAttribute('data-hr-filtered')).toBe(false);
  });
  it('keeps the places without a rating while a band is active', () => {
    page();
    document.querySelector('[role="feed"]').insertAdjacentHTML('beforeend', '<div role="article"><span>no rating</span></div>');
    const app = createApp(document, FAST, 0);
    app.scan();
    document.querySelectorAll('#list > [role="menuitemradio"]')[1].click();
    expect(document.querySelectorAll('[role="article"]')[2].hasAttribute('data-hr-filtered')).toBe(false);
  });
  describe('loading more results for a narrow filter', () => {
    function feedWith(extra, label = '2.0 stars 100 Reviews') {
      page();
      const feed = document.querySelector('[role="feed"]');
      Object.defineProperty(feed, 'scrollHeight', { value: 500, configurable: true });
      const state = { loads: 0, resets: 0 };
      Object.defineProperty(feed, 'scrollTop', {
        configurable: true,
        get: () => 0,
        set(value) {
          if (value === 0) state.resets += 1;
          else {
            state.loads += 1;
            if (state.loads <= extra) feed.insertAdjacentHTML('beforeend', card(label));
          }
        },
      });
      return state;
    }
    it('scrolls until enough places match or nothing new arrives, then scrolls back', async () => {
      const state = feedWith(2);
      const app = createApp(document, FAST, 0);
      app.scan();
      const rows = document.querySelectorAll('.hr-menu-item');
      rows[1].click();
      rows[2].click(); // a second request while the first is still loading is ignored
      await vi.waitFor(() => expect(state.resets).toBe(1));
      expect(state.loads).toBe(3);
      expect(document.querySelectorAll('[role="article"]:not([data-hr-filtered])')).toHaveLength(3);
    });
    it('stops at once when enough places already match', async () => {
      const state = feedWith(0);
      document.querySelector('[role="feed"]').insertAdjacentHTML('beforeend', card('2.0 stars 100 Reviews').repeat(8));
      const app = createApp(document, FAST, 0);
      app.scan();
      document.querySelectorAll('.hr-menu-item')[1].click();
      await vi.waitFor(() => expect(state.resets).toBe(1));
      expect(state.loads).toBe(0);
    });
    it('gives up after the maximum number of loads', async () => {
      const state = feedWith(Infinity, '4.0 stars 1,000 Reviews');
      createApp(document, FAST, 0).scan();
      document.querySelectorAll('.hr-menu-item')[4].click();
      await vi.waitFor(() => expect(state.resets).toBe(1));
      expect(state.loads).toBe(10);
    });
    it('does nothing without a feed or without an active filter', () => {
      page();
      document.querySelector('[role="feed"]').remove();
      const app = createApp(document, FAST, 0);
      app.scan();
      document.querySelectorAll('.hr-menu-item')[1].click();
      expect(document.querySelectorAll('[role="article"]')).toHaveLength(0);
    });
  });
  it('shows no Maps option as selected while the negative view is active, and watches a menu once', () => {
    page();
    const app = createApp(document, FAST);
    app.scan();
    document.querySelectorAll('.hr-menu-item')[2].click();
    expect(document.querySelectorAll('#list > [aria-checked="true"]')).toHaveLength(0);
    document.getElementById('list').innerHTML = '<div role="menuitemradio" aria-checked="true"><div>Any rating</div></div><div role="menuitemradio" aria-checked="true"><span aria-label="2.0 stars"></span></div>';
    app.enhanceMenus();
    const mapsItems = [...document.querySelectorAll('#list > [role="menuitemradio"]')];
    expect(mapsItems.map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'false']);
    expect(document.querySelectorAll('.hr-menu-item')[2].getAttribute('aria-checked')).toBe('true');
    mapsItems[0].click();
    expect(html.hasAttribute('data-hr-negative')).toBe(false);
  });
  it('adds the section again when Maps rebuilds the rows and remembers the pick', () => {
    page();
    const app = createApp(document, FAST);
    app.scan();
    document.querySelectorAll('.hr-menu-item')[1].click();
    document.getElementById('list').innerHTML = '<div role="menuitemradio"><span aria-label="2.0 stars"></span></div>';
    expect(document.querySelectorAll('.hr-menu-section')).toHaveLength(0);
    app.enhanceMenus();
    expect(document.querySelectorAll('.hr-menu-section')).toHaveLength(1);
    expect(document.querySelectorAll('.hr-menu-item')[1].getAttribute('aria-checked')).toBe('true');
  });
  it('ignores menus without star rows', () => {
    document.body.innerHTML = '<div role="menu" aria-label="Empty"></div><div role="menu"><div role="menuitemradio"><span aria-label="x"></span></div></div>';
    createApp(document, FAST).scan();
    expect(document.querySelector('.hr-menu-section')).toBeNull();
  });
});

describe('place overlay', () => {
  const go = (path) => window.history.replaceState({}, '', path);
  const overlayText = () => document.getElementById('hr-overlay').textContent;
  const histogram = [5, 4, 3, 2, 1].map((s) => `<span role="img" aria-label="${s} stars, ${s === 1 ? 20 : 10 * s} reviews"></span>`).join('');

  function placePage(title) {
    document.body.innerHTML = `<div role="main"><h1>${title}</h1><span role="img" aria-label="4.0 stars 500 Reviews"></span>${histogram}
      <button role="tab" aria-label="Overview" aria-selected="true"></button><button role="tab" aria-label="Reviews" aria-selected="false"></button><div id="area"></div></div>`;
    const area = document.getElementById('area');
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      area.innerHTML = '<button data-value="Sort"></button>';
      area.querySelector('button').addEventListener('click', () => {
        area.insertAdjacentHTML('beforeend', '<i role="menuitemradio"></i>'.repeat(3) + '<i role="menuitemradio" id="lowest"></i>');
        document.getElementById('lowest').addEventListener('click', () => {
          area.insertAdjacentHTML('beforeend', '<div data-review-id="r"><span role="img" aria-label="1 star"></span><span class="wiI7pd">Bad</span></div>');
        });
      });
    });
  }

  afterEach(() => go('/'));

  it('shows the exact numbers at once and the reviews later, hiding the panel meanwhile', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = createApp(document, FAST);
    app.scan();
    expect(overlayText()).toContain('Loading');
    expect(overlayText()).toContain('25% (40 / 160)');
    expect(overlayText()).toContain('Google rating 4.0');
    expect(document.documentElement.classList.contains('hr-collecting')).toBe(true);
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'));
    expect(document.documentElement.classList.contains('hr-collecting')).toBe(false);
  });
  it('does not restart when the title changes while tabs switch, and caches the result', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = createApp(document, FAST);
    app.scan();
    document.querySelector('h1').textContent = 'Something else';
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'));
    expect(overlayText()).toContain('Cafe');
    go('/maps/search/x');
    app.scan();
    expect(document.getElementById('hr-overlay')).toBeNull();
    go('/maps/place/Cafe/@1,2,3z');
    app.scan();
    expect(overlayText()).toContain('Bad');
  });
  it('ignores a stale run when another place opens', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = createApp(document, FAST);
    app.scan();
    go('/maps/place/Bar/@1,2,3z');
    document.querySelector('h1').textContent = 'Bar';
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'));
    expect(overlayText()).toContain('Bar');
  });
  it('takes the last h1 outside the results list, or the URL name without one', async () => {
    go('/maps/place/Real%20Place+Two/@1,2,3z');
    document.body.innerHTML = '<div role="main"><div role="feed"><h1>Results</h1></div><h1>Sponsored</h1><h1>Real Place</h1><h1> </h1></div>';
    const app = createApp(document, FAST);
    app.scan();
    expect(overlayText()).toContain('Real Place');
    go('/maps/place/Other%20Place+Two/@1,2,3z');
    document.body.innerHTML = '<div role="main"></div>';
    app.scan();
    expect(overlayText()).toContain('Other Place Two');
    await vi.waitFor(() => expect(overlayText()).toContain('No bad reviews'));
  });
  it('works without a main region, a rating or a reviews tab', async () => {
    go('/maps/place/Lonely/@1,2,3z');
    document.body.innerHTML = '<h1>Lonely</h1>';
    createApp(document, FAST).scan();
    await vi.waitFor(() => expect(overlayText()).toContain('No bad reviews'));
  });
});

describe('start', () => {
  it('scans immediately and again after DOM changes', async () => {
    vi.useFakeTimers();
    results(card());
    start(document, window);
    expect(document.querySelectorAll('[data-hr-badge]')).toHaveLength(1);
    document.querySelector('[role="feed"]').insertAdjacentHTML('beforeend', card('3.0 stars 10 Reviews'));
    await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelectorAll('[data-hr-badge]')).toHaveLength(2);
  });
});
