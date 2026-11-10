import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, start } from '../src/app.js';

const FAST = { timeout: 30, interval: 5, settle: 0, restore: 0 };
// The app tests run whole collections with real timers. vi.waitFor waits 1 s by default and a test 5 s, too little
// on a busy machine (coverage, parallel files); this file allows more.
const SLOW = { timeout: 10000 };
vi.setConfig({ testTimeout: 30000 });

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Every app of a test finishes its work before the next test starts, so a late result cannot land in the next page.
const apps = [];
function newApp(...args) {
  const app = createApp(...args);
  apps.push(app);
  return app;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.idle()));
});

describe('place overlay', () => {
  const go = (path) => window.history.replaceState({}, '', path);
  const overlayText = () => document.getElementById('hr-overlay').textContent;
  const histogram = [5, 4, 3, 2, 1]
    .map((s) => `<span role="img" aria-label="${s} stars, ${s === 1 ? 20 : 10 * s} reviews"></span>`)
    .join('');

  function placePage(title) {
    document.body.innerHTML = `<div role="main"><h1>${title}</h1><span role="img" aria-label="4.0 stars 500 Reviews"></span>${histogram}
      <button role="tab" aria-label="Overview" aria-selected="true"></button><button role="tab" aria-label="Reviews" aria-selected="false"></button><div id="area"></div></div>`;
    const area = document.getElementById('area');
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      area.innerHTML = '<button data-value="Sort"></button>';
      area.querySelector('button').addEventListener('click', () => {
        area.insertAdjacentHTML(
          'beforeend',
          '<i role="menuitemradio"></i>'.repeat(3) + '<i role="menuitemradio" id="lowest"></i>',
        );
        document.getElementById('lowest').addEventListener('click', () => {
          area.insertAdjacentHTML(
            'beforeend',
            '<div data-review-id="r"><span role="img" aria-label="1 star"></span><span class="wiI7pd">Bad</span></div>',
          );
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
    const app = newApp(document, FAST);
    app.scan();
    expect(overlayText()).toContain('Loading');
    await vi.waitFor(() => expect(overlayText()).toContain('25% (40 / 160)'), SLOW);
    expect(overlayText()).toContain('Google rating 4.0');
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), SLOW);
    expect(hiddenWhileSwitching).toBe(true);
    expect(document.documentElement.classList.contains('hr-collecting')).toBe(false);
  });
  it('does not restart when the title changes while tabs switch, and caches the result', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = newApp(document, FAST);
    app.scan();
    document.querySelector('h1').textContent = 'Something else';
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), SLOW);
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
    // The new panel comes after 10 ms; the app must still be waiting for it then, even on a busy machine.
    const app = newApp(document, { ...FAST, timeout: 2000 });
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), SLOW);
    go('/maps/place/Bar/@1,2,3z');
    app.scan(); // the URL is new, the panel still shows Cafe
    expect(overlayText()).toContain('Bar');
    expect(overlayText()).not.toContain('Cafe');
    expect(overlayText()).not.toContain('Google rating');
    setTimeout(() => {
      placePage('Bar');
      document.querySelector('[role="main"] [aria-label^="5 stars"]').setAttribute('aria-label', '5 stars, 70 reviews');
    }, 10);
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), SLOW);
    expect(overlayText()).toContain('Bar');
    expect(overlayText()).toContain('Google rating 4.0');
    expect(overlayText()).toContain('22% (40 / 180)');
  });
  it('shows a cached place again, with the URL name when the panel has no title yet', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = newApp(document, FAST);
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), SLOW);
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
    newApp(document).scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), SLOW);
    // let the collector finish, so it does not run into the next test
    await vi.waitFor(() => expect(overlayText()).not.toContain('Loading'), SLOW);
  });
  it('shows the reviews while they load and shows one in Google Maps on click', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const snapshots = [];
    const observer = new MutationObserver(() =>
      snapshots.push(document.getElementById('hr-overlay')?.textContent ?? ''),
    );
    observer.observe(document.body, { childList: true, subtree: true });
    newApp(document, FAST).scan();
    await vi.waitFor(() => expect(overlayText()).not.toContain('Loading'), SLOW);
    observer.disconnect();
    expect(snapshots.some((text) => text.includes('Loading the negative reviews') && text.includes('Bad'))).toBe(true);
    document.querySelector('.hr-review').click();
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled(), SLOW);
    expect(document.querySelector('[data-review-id="r"]').classList.contains('hr-flash')).toBe(true);
    delete window.HTMLElement.prototype.scrollIntoView;
  });
  describe('Load more', () => {
    function more() {
      go('/maps/place/Cafe/@1,2,3z');
      placePage('Cafe');
      Object.defineProperty(document.body, 'scrollHeight', { value: 100, configurable: true });
      Object.defineProperty(document.body, 'clientHeight', { value: 10, configurable: true });
      const state = { loads: 0 };
      // Maps starts the review list from the beginning whenever the reviews tab opens.
      document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
        state.loads = 0;
      });
      Object.defineProperty(document.body, 'scrollTop', {
        configurable: true,
        get: () => 0,
        set(value) {
          if (value > 0 && state.loads < 40) {
            state.loads += 1;
            document
              .getElementById('area')
              .insertAdjacentHTML(
                'beforeend',
                `<div data-review-id="m${state.loads}"><span role="img" aria-label="2 stars"></span><span class="wiI7pd">More ${state.loads}</span></div>`,
              );
          }
        },
      });
      return state;
    }
    afterEach(() => {
      delete document.body.scrollHeight;
      delete document.body.clientHeight;
      delete document.body.scrollTop;
    });

    it('loads more negative reviews on request and shows the new count', async () => {
      const state = more();
      newApp(document, FAST).scan();
      await vi.waitFor(() => expect(document.querySelector('.hr-overlay__more')).not.toBeNull(), SLOW);
      const before = document.querySelectorAll('.hr-review').length;
      document.querySelector('.hr-overlay__more').click();
      await vi.waitFor(() => expect(document.querySelectorAll('.hr-review').length).toBeGreaterThan(before), SLOW);
      // 41 loaded now, the histogram knows 40: nothing left to load
      await vi.waitFor(() => expect(overlayText()).not.toContain('Loading the negative reviews'), SLOW);
      expect(document.querySelector('.hr-overlay__more')).toBeNull();
      expect(state.loads).toBeGreaterThan(0);
      expect(overlayText()).toContain('41 negative reviews (1-2 stars), 1 star first');
    });
    it('says so instead of offering the button again when loading more brings nothing, also from the cache', async () => {
      go('/maps/place/Cafe/@1,2,3z');
      placePage('Cafe');
      const app = newApp(document, FAST);
      app.scan();
      await vi.waitFor(() => expect(document.querySelector('.hr-overlay__more')).not.toBeNull(), SLOW);
      const shown = document.querySelectorAll('.hr-review').length;
      go('/maps/search/x');
      app.scan();
      go('/maps/place/Cafe/@1,2,3z');
      app.scan(); // from the cache, the button is still there
      document.querySelector('.hr-overlay__more').click();
      await vi.waitFor(() => expect(overlayText()).toMatch(/\d+\/\d+ results loaded/), SLOW);
      expect(document.querySelector('.hr-overlay__more')).toBeNull();
      expect(document.querySelectorAll('.hr-review')).toHaveLength(shown);
      go('/maps/search/x');
      app.scan();
      go('/maps/place/Cafe/@1,2,3z');
      app.scan(); // the cache remembers that nothing more can be loaded
      expect(overlayText()).toMatch(/\d+\/\d+ results loaded/);
    });
    it('drops the result when the user leaves the place meanwhile', async () => {
      more();
      const app = newApp(document, FAST);
      app.scan();
      await vi.waitFor(() => expect(document.querySelector('.hr-overlay__more')).not.toBeNull(), SLOW);
      document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
        go('/maps/search/x');
        app.scan();
      });
      document.querySelector('.hr-overlay__more').click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(document.getElementById('hr-overlay')).toBeNull();
    });
  });
  it('drops a run that became stale while the reviews were collected', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = newApp(document, FAST);
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
    newApp(document, FAST).scan();
    expect(overlayText()).toContain('Ghost%E0%A4%A');
    await vi.waitFor(() => expect(overlayText()).toContain('Something else'), SLOW);
  });
  it('ignores a stale run when another place opens', async () => {
    go('/maps/place/Cafe/@1,2,3z');
    placePage('Cafe');
    const app = newApp(document, FAST);
    app.scan();
    go('/maps/place/Bar/@1,2,3z');
    document.querySelector('h1').textContent = 'Bar';
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bad'), SLOW);
    expect(overlayText()).toContain('Bar');
  });
  it('takes the last h1 outside the results list, or the URL name without one', async () => {
    go('/maps/place/Real%20Place+Two/@1,2,3z');
    document.body.innerHTML =
      '<div role="main"><div role="feed"><h1>Results</h1></div><h1>Sponsored</h1><h1>Real Place</h1><h1> </h1></div>';
    const app = newApp(document, FAST);
    app.scan();
    expect(overlayText()).toContain('Real Place');
    go('/maps/place/Other%20Place+Two/@1,2,3z');
    document.body.innerHTML = '<div role="main"></div>';
    app.scan();
    expect(overlayText()).toContain('Other Place Two');
    await vi.waitFor(() => expect(overlayText()).toContain('No negative reviews'), SLOW);
  });
  it('works without a main region, a rating or a reviews tab', async () => {
    go('/maps/place/Lonely/@1,2,3z');
    document.body.innerHTML = '<h1>Lonely</h1>';
    newApp(document, FAST).scan();
    await vi.waitFor(() => expect(overlayText()).toContain('No negative reviews'), SLOW);
  });
});

describe('idle', () => {
  it('resolves once the place is open and at once when nothing runs', async () => {
    window.history.replaceState({}, '', '/maps/place/Nowhere/@1,2,3z');
    const app = createApp(document, FAST);
    await app.idle();
    app.scan();
    await app.idle();
    expect(document.getElementById('hr-overlay').textContent).toContain('Nowhere');
    window.history.replaceState({}, '', '/');
  });
});

describe('start', () => {
  it('opens the overlay for a place right away or after the page changes, and leaves Maps untouched', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/maps/search/restaurants');
    document.body.innerHTML =
      '<div role="feed"><div role="article"><span role="img" aria-label="4.0 stars 100 Reviews"></span></div></div>';
    const before = document.body.innerHTML;
    start(document, window);
    expect(document.getElementById('hr-overlay')).toBeNull();
    window.history.replaceState({}, '', '/maps/place/Cafe/@1,2,3z');
    document.body.insertAdjacentHTML('beforeend', '<div role="main"><h1>Cafe</h1></div>');
    await vi.advanceTimersByTimeAsync(300);
    expect(document.getElementById('hr-overlay').textContent).toContain('Cafe');
    document.getElementById('hr-overlay').remove();
    document.querySelector('[role="main"]').remove();
    expect(document.body.innerHTML).toBe(before);
    window.history.replaceState({}, '', '/');
  });
});
