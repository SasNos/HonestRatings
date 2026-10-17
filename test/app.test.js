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
  it('places the chip after the rating chip and filters by negative stars', () => {
    results(card(), card('2.0 stars 100 Reviews'));
    createApp(document, FAST).scan();
    const chip = document.querySelector('.hr-chip');
    expect(document.querySelector('button').nextElementSibling).toBe(chip);
    chip.querySelectorAll('li')[4].click();
    const cards = document.querySelectorAll('[role="article"]');
    expect(cards[0].hasAttribute('data-hr-filtered')).toBe(false);
    expect(cards[1].hasAttribute('data-hr-filtered')).toBe(true);
    chip.querySelectorAll('li')[0].click();
    expect(cards[1].hasAttribute('data-hr-filtered')).toBe(false);
  });
  it('skips hidden duplicates and wrappers of the chip button', () => {
    document.body.innerHTML = `<div id="row"><div id="hidden"><button>Rating</button></div><div id="item"><div id="wrap"><button>Rating</button></div></div><div>Price</div></div><div role="feed">${card()}</div>`;
    const hidden = document.querySelector('#hidden button');
    Element.prototype.getClientRects.mockImplementation(function rects() {
      return this === hidden ? [] : [{}];
    });
    createApp(document, FAST).scan();
    expect(document.querySelector('#item').nextElementSibling.className).toBe('hr-chip');
    expect(document.querySelector('#hidden').querySelector('.hr-chip')).toBeNull();
  });
  it('ignores long button texts that merely mention a rating', () => {
    document.body.innerHTML = `<button>Show everything about the rating of this place</button><div role="feed">${card()}</div>`;
    createApp(document, FAST).scan();
    expect(document.querySelectorAll('.hr-chip--floating')).toHaveLength(1);
  });
  it('floats the chip when there is no rating chip, and only with results', () => {
    document.body.innerHTML = '<p>nothing</p>';
    const app = createApp(document, FAST);
    app.scan();
    expect(document.querySelector('.hr-chip')).toBeNull();
    document.body.innerHTML = `<div role="feed">${card()}</div>`;
    app.scan();
    app.scan();
    expect(document.querySelectorAll('.hr-chip--floating')).toHaveLength(1);
  });
});

describe('place overlay', () => {
  function placePage(title) {
    document.body.innerHTML = `<div role="main"><h1>${title}</h1><span role="img" aria-label="4.0 stars 500 Reviews"></span>
      <button role="tab" aria-label="Overview" aria-selected="true"></button><button role="tab" aria-label="Reviews" aria-selected="false"></button><div id="area"></div></div>`;
    document.querySelectorAll('button[role="tab"]')[1].addEventListener('click', () => {
      document.getElementById('area').innerHTML = '<div data-review-id="r"><span role="img" aria-label="1 star"></span><span class="wiI7pd">Bad</span></div>';
    });
  }
  const overlayText = () => document.getElementById('hr-overlay').textContent;

  it('opens once per place, estimating from the panel rating without a histogram', async () => {
    placePage('Cafe');
    const app = createApp(document, FAST);
    app.scan();
    expect(overlayText()).toContain('Loading');
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Estimated from the average rating'));
    expect(overlayText()).toContain('Cafe');
  });
  it('ignores a stale run when another place opens, and closes when the place goes away', async () => {
    placePage('Cafe');
    const app = createApp(document, FAST);
    app.scan();
    document.querySelector('h1').textContent = 'Bar';
    app.scan();
    await vi.waitFor(() => expect(overlayText()).toContain('Bar'));
    await vi.waitFor(() => expect(overlayText()).not.toContain('Loading'));
    document.body.innerHTML = '';
    app.scan();
    expect(document.getElementById('hr-overlay')).toBeNull();
  });
  it('takes the last h1 outside the results list as the title', async () => {
    document.body.innerHTML = '<div role="main"><div role="feed"><h1>Results</h1></div><h1>Sponsored</h1><h1>Real Place</h1><h1> </h1></div>';
    createApp(document, FAST).scan();
    expect(overlayText()).toContain('Real Place');
    await vi.waitFor(() => expect(overlayText()).toContain('No bad reviews'));
  });
  it('works without a rating or a reviews tab', async () => {
    document.body.innerHTML = '<div role="main"><h1>Lonely</h1></div>';
    createApp(document, FAST).scan();
    await vi.waitFor(() => expect(overlayText()).toContain('No bad reviews'));
  });
  it('falls back to the document when the main region disappears during collection', async () => {
    document.body.innerHTML = '<div role="main"><h1>Y</h1></div>';
    createApp(document, FAST).scan();
    document.querySelector('[role="main"]').removeAttribute('role');
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
