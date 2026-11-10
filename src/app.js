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
  let run = 0;
  const cache = new Map();

  // Ads put a "Sponsored" h1 before the title; the results list has its own h1s.
  function panelTitle() {
    const titles = [...doc.querySelectorAll(SEL.placeTitle)].filter(
      (h1) => !h1.closest(SEL.feed) && h1.textContent.trim(),
    );
    return titles.at(-1)?.textContent.trim() || null;
  }

  // A click on a review shows it in the Google Maps panel.
  const onReview = (review) => revealReview(doc, review.id, collectOptions);

  // The newest result of the open place, for the "Load more" button.
  let latest = null;

  // Work that is still running (opening a place, "Load more"), so a host or a test can wait until it is done.
  let tail = Promise.resolve();
  function track(promise) {
    tail = Promise.allSettled([tail, promise]);
    return promise;
  }
  const onMore = () => track(loadMore());

  // "Load more": loads ten more negative reviews than are shown now.
  async function loadMore() {
    const { key, title, result } = latest;
    const mine = run;
    showOverlay({ title, ...result, loading: true, onReview, onMore });
    doc.documentElement.classList.add('hr-collecting');
    let reviews;
    try {
      reviews = await loadMoreReviews(doc, collectOptions, result.reviews.length + LOAD_STEP, (list) => {
        // Maps starts the list from the beginning: show it again only once it is longer.
        if (mine === run && list.length > result.reviews.length)
          showOverlay({ title, ...result, reviews: list, loading: true, onReview, onMore });
      });
    } finally {
      doc.documentElement.classList.remove('hr-collecting');
    }
    if (mine !== run) return;
    // No growth means Maps lists no more reviews than these.
    const grew = reviews.length > result.reviews.length;
    const next = { ...result, reviews: grew ? reviews : result.reviews, exhausted: !grew };
    latest = { key, title, result: next };
    cache.set(key, next);
    showOverlay({ title, ...next, onReview, onMore, scrollToReview: grew ? result.reviews.length : null });
  }

  function summaryOf(histogram) {
    const panel = ratingOf(doc.querySelector('[role="main"]') || doc);
    return summarize({ histogram, average: panel?.rating.average, total: panel?.rating.total });
  }

  async function openPlace(key) {
    const mine = ++run;
    const urlTitle = safeDecode(key).replace(/\+/g, ' ');
    const cached = cache.get(key);
    if (cached) {
      latest = { key, title: panelTitle() || urlTitle, result: cached };
      return showOverlay({ title: latest.title, ...cached, onReview, onMore });
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
      { ...collectOptions, timeout: Math.min(collectOptions.timeout ?? 4000, 3000) },
    );
    if (mine !== run) return;
    title = title || panelTitle() || urlTitle;
    // The overview already lists the star histogram, so the numbers show at once.
    const first = summaryOf(parseHistogram(doc));
    showOverlay({ title, summary: first, loading: true, onReview });
    // Hide the panel while the collector switches tabs, so it does not flicker.
    doc.documentElement.classList.add('hr-collecting');
    let data;
    try {
      // Show the reviews as they load, so the worst are in view at once.
      data = await collect(doc, collectOptions, (reviews) => {
        if (mine === run) showOverlay({ title, summary: first, reviews, loading: true, onReview });
      });
    } finally {
      doc.documentElement.classList.remove('hr-collecting');
    }
    if (mine !== run) return;
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
    run += 1;
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
