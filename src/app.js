import { SEL } from './dom/selectors.js';
import { parseHistogram, parseRatingLabel } from './dom/parse.js';
import { collect } from './dom/collect.js';
import { summarize } from './scoring.js';
import { renderBadge, BADGE_ATTR } from './ui/badge.js';
import { enhanceRatingMenu, SECTION_CLASS } from './ui/ratingMenu.js';
import { showOverlay, removeOverlay } from './ui/overlay.js';

const SCAN_DELAY = 200;

function ratingOf(scope) {
  for (const image of scope.querySelectorAll(SEL.ratingImage)) {
    // Our own stars carry labels like "2 of 5 negative stars"; they are not a rating.
    if (image.classList.contains('hr-stars')) continue;
    const rating = parseRatingLabel(image.getAttribute('aria-label'));
    if (rating) return { image, rating };
  }
  return null;
}

export function createApp(doc = document, collectOptions = {}) {
  let maxStars = 5;
  let place = null;
  let run = 0;
  const cache = new Map();

  function decorateCards() {
    // The list stays the original Maps one until a negative filter is chosen.
    doc.documentElement.toggleAttribute('data-hr-negative', maxStars < 5);
    for (const card of doc.querySelectorAll(SEL.card)) {
      const found = ratingOf(card);
      const label = found?.image.getAttribute('aria-label');
      let badge = card.querySelector(`[${BADGE_ATTR}]`);
      // Maps reuses card elements for other places when the list refreshes.
      if (badge && found && badge.dataset.hrSource !== label) {
        badge.remove();
        badge = null;
      }
      if (found && !badge) {
        const summary = summarize({ average: found.rating.average, total: found.rating.total });
        found.image.setAttribute('data-hr-hidden', '');
        badge = renderBadge(summary);
        badge.dataset.hrSource = label;
        badge.dataset.hrStars = String(summary.stars);
        found.image.after(badge);
      }
      card.toggleAttribute('data-hr-filtered', Number(badge?.dataset.hrStars) > maxStars);
    }
  }

  function pick(max, menu) {
    maxStars = max;
    decorateCards();
    // Escape on the menu is what closes a Maps menu reliably.
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  // Adds the "Negative" section to the original rating menu each time Maps
  // builds it. The rating menu is the one whose items carry star labels.
  function enhanceMenus() {
    for (const menu of doc.querySelectorAll(SEL.menu)) {
      const items = [...menu.querySelectorAll(SEL.sortOption)];
      const starred = items.find((item) => parseRatingLabel(item.querySelector('[aria-label]')?.getAttribute('aria-label')));
      // Maps keeps the menu element and rebuilds its rows, so look for our section, not a flag.
      if (!starred || menu.querySelector(`.${SECTION_CLASS}`)) continue;
      enhanceRatingMenu(starred.parentElement, maxStars, (max) => pick(max, menu));
    }
  }

  function titleOf(key) {
    // Ads put a "Sponsored" h1 before the title; the results list has its own h1s.
    const titles = [...doc.querySelectorAll(SEL.placeTitle)].filter((h1) => !h1.closest(SEL.feed) && h1.textContent.trim());
    return titles.at(-1)?.textContent.trim() || decodeURIComponent(key).replace(/\+/g, ' ');
  }

  function summaryOf(histogram) {
    const panel = ratingOf(doc.querySelector('[role="main"]') || doc);
    return summarize({ histogram, average: panel?.rating.average, total: panel?.rating.total });
  }

  async function openPlace(key) {
    const mine = ++run;
    const title = titleOf(key);
    const cached = cache.get(key);
    if (cached) return showOverlay({ title, ...cached });
    // The overview already lists the star histogram, so the numbers show at once.
    showOverlay({ title, summary: summaryOf(parseHistogram(doc)), loading: true });
    // Hide the panel while the collector switches tabs, so it does not flicker.
    doc.documentElement.classList.add('hr-collecting');
    let data;
    try {
      data = await collect(doc, collectOptions);
    } finally {
      doc.documentElement.classList.remove('hr-collecting');
    }
    if (mine !== run) return;
    const result = { summary: summaryOf(data?.histogram ?? null), reviews: data?.reviews ?? [], signedOut: data?.signedOut, debug: data?.debug };
    // An empty result is not cached: it may just be a slow load, and a revisit should retry.
    if (result.reviews.length > 0) cache.set(key, result);
    showOverlay({ title, ...result });
  }

  // The place comes from the URL: the title and the panel change while the
  // collector switches tabs, the path does not.
  function trackPlace() {
    const key = doc.location.pathname.match(/\/maps\/place\/([^/]+)/)?.[1] ?? null;
    if (key === place) return;
    place = key;
    run += 1;
    removeOverlay();
    if (key) openPlace(key);
  }

  function scan() {
    enhanceMenus();
    decorateCards();
    trackPlace();
  }

  return { scan, enhanceMenus };
}

export function start(doc = document, win = window) {
  const app = createApp(doc);
  let timer = null;
  const schedule = () => {
    win.clearTimeout(timer);
    // The menu is enhanced at once so it does not visibly grow; the rest is debounced.
    app.enhanceMenus();
    timer = win.setTimeout(app.scan, SCAN_DELAY);
  };
  new win.MutationObserver(schedule).observe(doc.body, { childList: true, subtree: true });
  app.scan();
  return app;
}
