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
  const mapsRow = (label, checked = false) => `<div role="menuitemradio" aria-checked="${checked}"><span aria-label="${label}"></span></div>`;
  const anyRow = '<div role="menuitemradio" aria-checked="true"><div>Any rating</div></div>';
  const fullMenu = anyRow + mapsRow('2.0 stars') + mapsRow('3.0 stars') + mapsRow('4.0 stars');

  function page(rows = fullMenu) {
    document.body.innerHTML = `<div role="menu" aria-label="Rating"><div id="list">${rows}</div></div><div role="menu" aria-label="Sort"><div><div role="menuitemradio">Newest</div></div></div><div role="feed">${card()}${card('2.0 stars 100 Reviews')}</div>`;
    const escapes = vi.fn();
    const clicks = {};
    document.querySelector('[aria-label="Rating"]').addEventListener('keydown', (event) => event.key === 'Escape' && escapes());
    document.querySelectorAll('#list > [role="menuitemradio"]').forEach((item, index) => {
      clicks[index] = vi.fn();
      item.addEventListener('click', clicks[index]);
    });
    return { escapes, clicks };
  }
  const html = document.documentElement;
  const rows = () => document.querySelectorAll('.hr-menu-item');

  it('adds the Negative section to the rating menu only, once, with no row selected', () => {
    page();
    const app = createApp(document, FAST);
    app.scan();
    app.scan();
    expect(document.querySelectorAll('.hr-menu-section')).toHaveLength(1);
    expect(document.getElementById('list').lastElementChild.className).toBe('hr-menu-section');
    expect(rows()).toHaveLength(3);
    expect([...rows()].some((row) => row.getAttribute('aria-checked') === 'true')).toBe(false);
    expect(html.hasAttribute('data-hr-negative')).toBe(false);
  });
  it('sets Maps to Any rating, unselects the Maps options and closes the menu on a negative pick', () => {
    const { escapes, clicks } = page();
    createApp(document, FAST, 0).scan();
    rows()[0].click();
    rows()[1].click();
    rows()[2].click();
    expect(clicks[0]).toHaveBeenCalledTimes(3); // "Any rating", clicked by the extension itself
    expect(clicks[1]).not.toHaveBeenCalled();
    expect(escapes).toHaveBeenCalledTimes(3);
    expect(html.hasAttribute('data-hr-negative')).toBe(true); // our own click keeps the view
    expect(document.querySelectorAll('#list > [aria-checked="true"]')).toHaveLength(0);
  });
  it('keeps only places with a Google rating below 6 minus N, and places without a rating', () => {
    page();
    document.querySelector('[role="feed"]').insertAdjacentHTML('beforeend', '<div role="article"><span>no rating</span></div>');
    createApp(document, FAST, 0).scan();
    const cards = () => [...document.querySelectorAll('[role="article"]')].map((c) => c.hasAttribute('data-hr-filtered'));
    // Google 4.0, Google 2.0, no rating
    expect(cards()).toEqual([false, false, false]);
    rows()[0].click(); // below 5.0
    expect(cards()).toEqual([false, false, false]);
    rows()[1].click(); // below 4.0
    expect(cards()).toEqual([true, false, false]);
    rows()[2].click(); // below 3.0
    expect(cards()).toEqual([true, false, false]);
    document.querySelectorAll('#list > [role="menuitemradio"]')[1].click(); // a Maps option leaves the view
    expect(cards()).toEqual([false, false, false]);
  });
  it('leaves the negative view when a Maps option is picked, but not for our own section', () => {
    page();
    createApp(document, FAST).scan();
    rows()[0].click();
    expect(html.hasAttribute('data-hr-negative')).toBe(true);
    document.querySelector('.hr-menu-heading').click();
    document.querySelector('[aria-label="Rating"]').click();
    expect(html.hasAttribute('data-hr-negative')).toBe(true);
    document.querySelectorAll('#list > [role="menuitemradio"]')[1].click();
    expect(html.hasAttribute('data-hr-negative')).toBe(false);
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
      createApp(document, FAST, 0).scan();
      rows()[1].click();
      rows()[2].click(); // a second request while the first is still loading is ignored
      await vi.waitFor(() => expect(state.resets).toBe(1));
      expect(state.loads).toBe(3);
      expect(document.querySelectorAll('[role="article"]:not([data-hr-filtered])')).toHaveLength(3);
    });
    it('stops at once when enough places already match', async () => {
      const state = feedWith(0);
      document.querySelector('[role="feed"]').insertAdjacentHTML('beforeend', card('2.0 stars 100 Reviews').repeat(8));
      createApp(document, FAST, 0).scan();
      rows()[1].click();
      await vi.waitFor(() => expect(state.resets).toBe(1));
      expect(state.loads).toBe(0);
    });
    it('gives up after the maximum number of loads', async () => {
      const state = feedWith(Infinity, '4.0 stars 1,000 Reviews');
      createApp(document, FAST, 0).scan();
      rows()[2].click(); // below 3.0 hides every 4.0 place
      await vi.waitFor(() => expect(state.resets).toBe(1));
      expect(state.loads).toBe(10);
    });
    it('does nothing without a feed or without an active filter', () => {
      page();
      document.querySelector('[role="feed"]').remove();
      createApp(document, FAST, 0).scan();
      rows()[1].click();
      expect(document.querySelectorAll('[role="article"]')).toHaveLength(0);
    });
  });
  it('adds the section again when Maps rebuilds the rows, remembering the pick and unselecting Maps', () => {
    page();
    const app = createApp(document, FAST);
    app.scan();
    rows()[0].click(); // 1 negative star
    document.getElementById('list').innerHTML = mapsRow('4.0 stars', true) + mapsRow('3.0 stars', true);
    expect(document.querySelectorAll('.hr-menu-section')).toHaveLength(0);
    app.enhanceMenus();
    expect(document.querySelectorAll('.hr-menu-section')).toHaveLength(1);
    expect(rows()[0].getAttribute('aria-checked')).toBe('true');
    expect(document.querySelectorAll('#list > [aria-checked="true"]')).toHaveLength(0);
    document.querySelectorAll('#list > [role="menuitemradio"]')[0].click();
    expect(html.hasAttribute('data-hr-negative')).toBe(false);
  });
  describe('worst-first order in the negative view', () => {
    const place = (name, label) => `<div data-name="${name}"><div role="article"><span role="img" aria-label="${label}"></span></div></div><div data-name="${name}-divider"></div>`;
    function feedPage() {
      page();
      document.querySelector('[role="feed"]').innerHTML =
        '<div data-name="header">Results</div>' +
        place('A', '4.0 stars 100 Reviews') +
        place('B', '2.0 stars 100 Reviews') +
        place('C', '3.5 stars 100 Reviews') +
        place('C2', '3.0 stars 100 Reviews') +
        place('C3', '3.2 stars 100 Reviews') +
        '<div data-name="plain"><div role="article"><span>no rating</span></div></div>' +
        '<div role="article" data-name="direct"><span role="img" aria-label="4.5 stars 10 Reviews"></span></div>' +
        '<div data-name="footer">You are seeing a limited view</div><div data-name="footer-tail"></div>';
    }
    const sequence = () => [...document.querySelector('[role="feed"]').children]
      .map((child, index) => ({ name: child.dataset.name, order: Number(child.style.order), index }))
      .sort((x, y) => x.order - y.order || x.index - y.index)
      .map((entry) => entry.name);

    it('puts the worst places first, keeps dividers with their place, headers on top and footers at the end', () => {
      feedPage();
      const app = createApp(document, FAST);
      app.scan();
      expect(sequence()).toEqual(['header', 'A', 'A-divider', 'B', 'B-divider', 'C', 'C-divider', 'C2', 'C2-divider', 'C3', 'C3-divider', 'plain', 'direct', 'footer', 'footer-tail']);
      rows()[2].click();
      // 2.0 = 5 negative stars, 3.0 and 3.2 = 4 and 3-4, 3.5 = 3, 4.0 = 1, 4.5 = 1; unrated after rated
      expect(sequence()).toEqual(['header', 'B', 'B-divider', 'C2', 'C2-divider', 'C3', 'C3-divider', 'C', 'C-divider', 'A', 'A-divider', 'direct', 'plain', 'footer', 'footer-tail']);
    });
    it('removes the order again when the negative view is left', () => {
      feedPage();
      createApp(document, FAST).scan();
      rows()[0].click();
      expect(document.querySelector('[data-name="B"]').style.order).not.toBe('');
      document.querySelectorAll('#list > [role="menuitemradio"]')[0].click();
      expect([...document.querySelector('[role="feed"]').children].every((child) => child.style.order === '')).toBe(true);
    });
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
    let hiddenWhileSwitching = null;
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      hiddenWhileSwitching = document.documentElement.classList.contains('hr-collecting');
    });
    const app = createApp(document, FAST);
    app.scan();
    expect(overlayText()).toContain('Loading');
    await vi.waitFor(() => expect(overlayText()).toContain('25% (40 / 160)'));
    expect(overlayText()).toContain('Google rating 4.0');
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'));
    expect(hiddenWhileSwitching).toBe(true);
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
  it('waits for the panel of the new place so no numbers of the previous place are shown', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = createApp(document, FAST);
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'));
    go('/maps/place/Bar/@1,2,3z');
    app.scan(); // the URL is new, the panel still shows Cafe
    expect(overlayText()).toContain('Bar');
    expect(overlayText()).not.toContain('Cafe');
    expect(overlayText()).not.toContain('Google rating');
    setTimeout(() => {
      placePage('Bar');
      document.querySelector('[role="main"] [aria-label^="5 stars"]').setAttribute('aria-label', '5 stars, 70 reviews');
    }, 10);
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'));
    expect(overlayText()).toContain('Bar');
    expect(overlayText()).toContain('Google rating 4.0');
    expect(overlayText()).toContain('22% (40 / 180)');
  });
  it('shows a cached place again, with the URL name when the panel has no title yet', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = createApp(document, FAST);
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'));
    go('/maps/search/x');
    app.scan();
    document.querySelector('h1').remove();
    go('/maps/place/Cafe/@1,2,3z');
    app.scan();
    expect(overlayText()).toContain('Cafe');
    expect(overlayText()).toContain('Bad');
  });
  it('works with the default timeouts', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    createApp(document).scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), { timeout: 6000 });
  });
  it('drops a run that became stale while the reviews were collected', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = createApp(document, FAST);
    // The user leaves the place right when the collector opens the reviews tab.
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      go('/maps/search/x');
      app.scan();
    });
    app.scan();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.getElementById('hr-overlay')).toBeNull();
  });
  it('gives up waiting when the panel never shows the place, and copes with a broken URL name', async () => {
    go('/maps/place/Ghost%E0%A4%A/@1,2,3z');
    placePage('Something else');
    createApp(document, FAST).scan();
    expect(overlayText()).toContain('Ghost%E0%A4%A');
    await vi.waitFor(() => expect(overlayText()).toContain('Something else'));
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
