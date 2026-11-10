import { SEL } from './dom/selectors.js';
import { parseHistogram, parseRatingLabel } from './dom/parse.js';
import { collect, loadMoreReviews, revealReview, waitFor } from './dom/collect.js';
import { summarize } from './scoring.js';
import { showOverlay, removeOverlay, LOAD_STEP } from './ui/overlay.js';

const SCAN_DELAY = 200;

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
    const rating = parseRatingLabel(image.getAttribute('aria-label'));
    if (rating) return { image, rating };
  }
  return null;
}

// The extension changes nothing in Maps' own lists and menus. It only shows the
// overlay with the negative reviews of the place that is open.
export function createApp(doc = document, collectOptions = {}) {
  let place = null;
  // Cancels the work for the place that was open before (scan() replaces it for every new place).
  let controller = new AbortController();
  const cache = new Map();

  // Ads put a "Sponsored" h1 before the title; the results list has its own h1s.
  function panelTitle() {
    const titles = [...doc.querySelectorAll(SEL.placeTitle)].filter(
      (h1) => !h1.closest(SEL.feed) && h1.textContent.trim(),
    );
    return titles.at(-1)?.textContent.trim() || null;
  }

  // Hides the Maps panel while a collection switches its tabs, so it does not flicker. Counted, because a
  // cancelled run may still be finishing while the next one has started.
  let collecting = 0;
  function hidePanel() {
    collecting += 1;
    doc.documentElement.classList.add('hr-collecting');
  }
  function showPanel() {
    collecting -= 1;
    if (collecting === 0) doc.documentElement.classList.remove('hr-collecting');
  }

  // A click on a review shows it in the Google Maps panel; not while a collection drives the same list.
  const onReview = (review) => {
    if (collecting === 0) revealReview(doc, review.id, collectOptions);
  };

  // The newest result of the open place, for the "Load more" button.
  let latest = null;

  // Work that is still running (opening a place, "Load more"), so a host or a test can wait until it is done.
  let tail = Promise.resolve();
  function track(promise) {
    tail = Promise.allSettled([tail, promise]).then(() => undefined);
    return promise;
  }
  const onMore = () => track(loadMore());

  // "Load more": loads ten more negative reviews than are shown now.
  async function loadMore() {
    const { key, title, result } = latest;
    const { signal } = controller;
    showOverlay({ title, ...result, loading: true, onReview, onMore });
    hidePanel();
    let more;
    try {
      more = await loadMoreReviews(doc, { ...collectOptions, signal }, result.reviews.length + LOAD_STEP, (list) => {
        // Maps starts the list from the beginning: show it again only once it is longer.
        if (!signal.aborted && list.length > result.reviews.length)
          showOverlay({ title, ...result, reviews: list, loading: true, onReview, onMore });
      });
    } finally {
      showPanel();
    }
    if (signal.aborted) return;
    const grew = more.reviews.length > result.reviews.length;
    // Only a complete pass without growth means Maps lists no more reviews than these; a pass that stopped
    // early (load limit, no scroll area) keeps the button.
    const next = { ...result, reviews: grew ? more.reviews : result.reviews, exhausted: !grew && more.complete };
    latest = { key, title, result: next };
    // An empty result is not cached (see openPlace).
    if (next.reviews.length > 0) cache.set(key, next);
    // Sorted by stars, new reviews can land before old ones: scroll to the first one that was not shown.
    const shown = new Set(result.reviews.map((review) => review.id));
    const firstNew = grew ? next.reviews.findIndex((review) => !shown.has(review.id)) : -1;
    showOverlay({ title, ...next, onReview, onMore, scrollToReview: firstNew < 0 ? null : firstNew });
  }

  function summaryOf(histogram) {
    const panel = ratingOf(doc.querySelector('[role="main"]') || doc);
    return summarize({ histogram, average: panel?.rating.average, total: panel?.rating.total });
  }

  async function openPlace(key) {
    const { signal } = controller;
    const options = { ...collectOptions, signal };
    const urlTitle = safeDecode(key).replace(/\+/g, ' ');
    const cached = cache.get(key);
    if (cached) {
      latest = { key, title: panelTitle() || urlTitle, result: cached };
      showOverlay({ title: latest.title, ...cached, onReview, onMore });
      return;
    }
    showOverlay({ title: urlTitle, loading: true, onReview });
    // The URL changes before the panel does: wait until the panel shows this place, or give
    // up after a moment, so no numbers of the previous place are read.
    const wanted = slug(urlTitle);
    let title = null;
    await waitFor(
      () => {
        const shownTitle = panelTitle();
        const shown = slug(shownTitle || '');
        if (!shown || !(shown.includes(wanted) || wanted.includes(shown))) return false;
        title = shownTitle;
        return true;
      },
      { ...options, timeout: Math.min(collectOptions.timeout ?? 4000, 3000) },
    );
    if (signal.aborted) return;
    title = title || panelTitle() || urlTitle;
    // The overview already lists the star histogram, so the numbers show at once.
    const first = summaryOf(parseHistogram(doc));
    showOverlay({ title, summary: first, loading: true, onReview });
    hidePanel();
    let data;
    try {
      // Show the reviews as they load, so the worst are in view at once.
      data = await collect(doc, options, (reviews) => {
        if (!signal.aborted) showOverlay({ title, summary: first, reviews, loading: true, onReview });
      });
    } finally {
      showPanel();
    }
    if (signal.aborted) return;
    const result = {
      summary: summaryOf(data?.histogram ?? null),
      reviews: data?.reviews ?? [],
      signedOut: data?.signedOut,
      debug: data?.debug,
    };
    // An empty result is not cached: it may just be a slow load, and a revisit should retry.
    if (result.reviews.length > 0) cache.set(key, result);
    latest = { key, title, result };
    showOverlay({ title, ...result, onReview, onMore });
  }

  // The place comes from the URL: the title and the panel change while the
  // collector switches tabs, the path does not.
  function scan() {
    const key = doc.location.pathname.match(/\/maps\/place\/([^/]+)/)?.[1] ?? null;
    if (key === place) return;
    place = key;
    controller.abort();
    controller = new AbortController();
    removeOverlay();
    if (key) track(openPlace(key));
  }

  return { scan, idle: () => tail };
}

export function start(doc = document, win = window) {
  const app = createApp(doc);
  let timer = null;
  const schedule = () => {
    win.clearTimeout(timer);
    timer = win.setTimeout(app.scan, SCAN_DELAY);
  };
  new win.MutationObserver(schedule).observe(doc.body, { childList: true, subtree: true });
  app.scan();
  return app;
}
