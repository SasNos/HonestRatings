import { SEL } from './dom/selectors.js';
import { parseHistogram, parseRatingLabel } from './dom/parse.js';
import { collect, waitFor } from './dom/collect.js';
import { summarize } from './scoring.js';
import { renderBadge, BADGE_ATTR } from './ui/badge.js';
import { enhanceRatingMenu, SECTION_CLASS } from './ui/ratingMenu.js';
import { showOverlay, removeOverlay } from './ui/overlay.js';

const SCAN_DELAY = 200;
// Loading more results for a narrow filter: stop at this many visible places or tries.
const ENOUGH_RESULTS = 8;
const MAX_LOADS = 10;
// CSS order values for the negative view: headers first, then the places worst
// first, then places without a rating, then footers.
const ORDER_HEADER = 0;
const ORDER_RATED_BASE = 100000;
const ORDER_UNRATED = 150000;
const ORDER_FOOTER = 200000;

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// Letters and digits only, so "Castelli+Romani" and "Castelli Romani" compare equal.
const slug = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function ratingOf(scope) {
  for (const image of scope.querySelectorAll(SEL.ratingImage)) {
    // Our own stars carry labels like "2 of 5 negative stars"; they are not a rating.
    if (image.classList.contains('hr-stars')) continue;
    const rating = parseRatingLabel(image.getAttribute('aria-label'));
    if (rating) return { image, rating };
  }
  return null;
}

export function createApp(doc = document, collectOptions = {}, loadDelay = 700) {
  // 0: the original Maps view. 1-3: a negative row is picked. Maps is set to "Any rating"
  // and the list switches to purple negative stars, keeping only places with a Google
  // rating below (6 - N): 1 = below 5.0, 2 = below 4.0, 3 = below 3.0. A Maps option and
  // a negative row exclude each other.
  let negative = 0;
  let filling = false;
  let internalClick = false;
  const watched = new WeakSet();
  let place = null;
  let run = 0;
  const cache = new Map();

  function decorateCards() {
    // The list stays the original Maps one until a negative filter is chosen.
    doc.documentElement.toggleAttribute('data-hr-negative', negative > 0);
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
        badge.dataset.hrAverage = String(found.rating.average);
        found.image.after(badge);
      }
      // Places without a rating stay; rated places at or above the limit go.
      card.toggleAttribute('data-hr-filtered', negative > 0 && Boolean(found) && found.rating.average >= 6 - negative);
    }
    orderFeed();
  }

  // The negative view lists the worst places first. Maps has no sort for the list, so
  // the children of the feed get a CSS order (the DOM stays as Maps built it).
  // Textless children after a place (dividers) travel with that place.
  function orderFeed() {
    const feed = doc.querySelector(SEL.feed);
    if (!feed) return;
    let order = ORDER_HEADER;
    let seenPlace = false;
    for (const child of feed.children) {
      const place = child.getAttribute('role') === 'article' ? child : child.querySelector('[role="article"]');
      if (place) {
        const badge = place.querySelector(`[${BADGE_ATTR}]`);
        const key = badge ? Number(badge.dataset.hrStars) * 1000 + Math.round((5 - Number(badge.dataset.hrAverage)) * 100) : null;
        order = key === null ? ORDER_UNRATED : ORDER_RATED_BASE - key;
        seenPlace = true;
      } else if (seenPlace && child.textContent.trim()) {
        order = ORDER_FOOTER;
      }
      if (negative > 0) child.style.order = String(order);
      else child.style.removeProperty('order');
    }
  }

  // Maps only lists the first results; with a narrow filter scroll the list to load more.
  async function fillList() {
    const feed = doc.querySelector(SEL.feed);
    if (filling || !feed || negative === 0) return;
    filling = true;
    for (let tries = 0; tries < MAX_LOADS; tries += 1) {
      const before = doc.querySelectorAll(SEL.card).length;
      if (doc.querySelectorAll(`${SEL.card}:not([data-hr-filtered])`).length >= ENOUGH_RESULTS) break;
      feed.scrollTop = feed.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, loadDelay));
      decorateCards();
      if (doc.querySelectorAll(SEL.card).length === before) break;
    }
    feed.scrollTop = 0;
    filling = false;
  }

  function pick(rank, menu, mapsItems) {
    negative = rank;
    decorateCards();
    // Maps itself goes back to "Any rating" (its first item); the extension does the filtering.
    internalClick = true;
    mapsItems[0].click();
    internalClick = false;
    fillList();
    mapsItems.forEach((item) => item.setAttribute('aria-checked', 'false'));
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
      enhanceRatingMenu(starred.parentElement, negative, (rank) => pick(rank, menu, items));
      // While a negative row is picked no Maps option may look selected.
      if (negative > 0) items.forEach((item) => item.setAttribute('aria-checked', 'false'));
      if (!watched.has(menu)) {
        watched.add(menu);
        // Picking a Maps option (any of them) leaves the negative view.
        menu.addEventListener('click', (event) => {
          if (internalClick || event.target.closest(`.${SECTION_CLASS}`) || !event.target.closest(SEL.sortOption)) return;
          negative = 0;
          decorateCards();
        });
      }
    }
  }

  // Ads put a "Sponsored" h1 before the title; the results list has its own h1s.
  function panelTitle() {
    const titles = [...doc.querySelectorAll(SEL.placeTitle)].filter((h1) => !h1.closest(SEL.feed) && h1.textContent.trim());
    return titles.at(-1)?.textContent.trim() || null;
  }

  function summaryOf(histogram) {
    const panel = ratingOf(doc.querySelector('[role="main"]') || doc);
    return summarize({ histogram, average: panel?.rating.average, total: panel?.rating.total });
  }

  async function openPlace(key) {
    const mine = ++run;
    const urlTitle = safeDecode(key).replace(/\+/g, ' ');
    const cached = cache.get(key);
    if (cached) return showOverlay({ title: panelTitle() || urlTitle, ...cached });
    showOverlay({ title: urlTitle, loading: true });
    // The URL changes before the panel does: wait until the panel shows this place, or give
    // up after a moment, so no numbers of the previous place are read.
    const wanted = slug(urlTitle);
    let title = null;
    await waitFor(() => {
      const shownTitle = panelTitle();
      const shown = slug(shownTitle || '');
      if (!shown || !(shown.includes(wanted) || wanted.includes(shown))) return false;
      title = shownTitle;
      return true;
    }, { ...collectOptions, timeout: Math.min(collectOptions.timeout ?? 4000, 3000) });
    if (mine !== run) return;
    title = title || panelTitle() || urlTitle;
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
    // Maps reloads the list after a filter change: keep filling it while a filter is active.
    fillList();
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
