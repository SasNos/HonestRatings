import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, start } from '../src/app.js';

const FAST = { timeout: 30, interval: 5, settle: 0, restore: 0 };

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    createApp(document, FAST).scan();
    await vi.waitFor(() => expect(overlayText()).not.toContain('Loading'));
    observer.disconnect();
    expect(snapshots.some((text) => text.includes('Loading the negative reviews') && text.includes('Bad'))).toBe(true);
    document.querySelector('.hr-review').click();
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(document.querySelector('[data-review-id="r"]').classList.contains('hr-flash')).toBe(true);
    delete window.HTMLElement.prototype.scrollIntoView;
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
    document.body.innerHTML =
      '<div role="main"><div role="feed"><h1>Results</h1></div><h1>Sponsored</h1><h1>Real Place</h1><h1> </h1></div>';
    const app = createApp(document, FAST);
    app.scan();
    expect(overlayText()).toContain('Real Place');
    go('/maps/place/Other%20Place+Two/@1,2,3z');
    document.body.innerHTML = '<div role="main"></div>';
    app.scan();
    expect(overlayText()).toContain('Other Place Two');
    await vi.waitFor(() => expect(overlayText()).toContain('No negative reviews'));
  });
  it('works without a main region, a rating or a reviews tab', async () => {
    go('/maps/place/Lonely/@1,2,3z');
    document.body.innerHTML = '<h1>Lonely</h1>';
    createApp(document, FAST).scan();
    await vi.waitFor(() => expect(overlayText()).toContain('No negative reviews'));
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
