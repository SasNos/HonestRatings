import { SEL, SORT_LOWEST_INDEX, SORT_LABEL, REVIEWS_TAB } from './selectors.js';
import { parseHistogram, parseReview, reviewElements, negativeReviews } from './parse.js';
import { BAD_MAX_STARS } from '../scoring.js';

// Popular places have hundreds of negative reviews: allow many scroll loads.
const MAX_REVIEW_LOADS = 30;
const MAX_REVEAL_LOADS = 30;

export function waitFor(check, { timeout = 4000, interval = 100 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const value = check();
      if (value) return resolve(value);
      if (Date.now() - started >= timeout) return resolve(null);
      setTimeout(tick, interval);
    };
    tick();
  });
}

export function findReviewsTab(doc) {
  const tabs = [...doc.querySelectorAll(SEL.tab)];
  return tabs.find((tab) => REVIEWS_TAB.test((tab.getAttribute('aria-label') || tab.textContent).trim())) || null;
}

export function findSort(doc) {
  const known = doc.querySelector(SEL.sortButton);
  if (known) return known;
  return (
    [...doc.querySelectorAll(SEL.sortCandidate)].find((el) =>
      SORT_LABEL.test(el.getAttribute('aria-label') || el.textContent.slice(0, 40)),
    ) || null
  );
}

// Maps menus listen for the whole pointer sequence, not only for click().
function press(element) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  }
}

function scroller(element) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

// Sorts the review list by lowest rating through the sort menu. Returns the
// number of menu items (for the debug line).
async function sortLowest(doc, sort, options) {
  press(sort);
  const option = await waitFor(() => doc.querySelectorAll(SEL.sortOption)[SORT_LOWEST_INDEX], options);
  const items = doc.querySelectorAll(SEL.sortOption).length;
  if (option) {
    // Reviews may already be on screen in the old order: wait until the list changes.
    const before = doc.querySelector(SEL.review)?.getAttribute('data-review-id');
    press(option);
    await waitFor(() => {
      const first = doc.querySelector(SEL.review);
      return first && first.getAttribute('data-review-id') !== before;
    }, options);
    // Give Maps a moment to re-render the list in the new order.
    await new Promise((resolve) => setTimeout(resolve, options.settle ?? 600));
  }
  return items;
}

// Scrolls the review list to load more until done() is true, nothing new arrives,
// or the load limit is hit. onLoad() runs after every successful load.
async function scrollUntil(doc, box, options, { done, maxLoads, onLoad = () => {} }) {
  for (let tries = 0; box && tries < maxLoads; tries += 1) {
    if (done()) break;
    const before = reviewElements(doc).length;
    box.scrollTop = box.scrollHeight;
    await waitFor(() => reviewElements(doc).length > before, {
      ...options,
      timeout: Math.min(options.timeout ?? 4000, 1500),
    });
    if (reviewElements(doc).length === before) break;
    onLoad();
  }
}

// Sorted lowest first: once the last loaded review is above the bad ones, the rest is not needed.
function pastNegatives(doc) {
  const elements = reviewElements(doc);
  const lastStars = elements.length ? parseReview(elements.at(-1)).stars : null;
  return lastStars !== null && lastStars > BAD_MAX_STARS;
}

// Opens the reviews tab, sorts by lowest rating and reads the histogram and every
// negative review (1-2 stars), worst first. onProgress gets the list after each load.
// The previous tab is restored afterwards so the panel looks as the user left it.
export async function collect(doc, options = {}, onProgress = () => {}) {
  const reviewsTab = findReviewsTab(doc);
  if (!reviewsTab) return null;
  const previous = [...doc.querySelectorAll(SEL.tab)].find((tab) => tab.getAttribute('aria-selected') === 'true');
  const box = scroller(reviewsTab);
  const scrollTop = box?.scrollTop;
  reviewsTab.click();
  const histogram = await waitFor(() => parseHistogram(doc), options);
  const sort = await waitFor(() => findSort(doc), { ...options, timeout: Math.min(options.timeout ?? 4000, 2000) });
  const signedOut = Boolean(doc.querySelector(SEL.signIn));
  const debug = { sort: Boolean(sort), options: 0, reviewElements: 0, histogram };
  // Sorting needs a Google login; signed out, Maps would only show a sign-in dialog.
  if (sort && !signedOut) debug.options = await sortLowest(doc, sort, options);
  // Without sorting, the negative ones among the reviews Maps loaded are still useful.
  await waitFor(() => doc.querySelector(SEL.review), options);
  onProgress(negativeReviews(doc));
  await scrollUntil(doc, box, options, {
    done: () => pastNegatives(doc),
    maxLoads: MAX_REVIEW_LOADS,
    onLoad: () => onProgress(negativeReviews(doc)),
  });
  const reviews = negativeReviews(doc);
  const parsed = reviewElements(doc).map(parseReview);
  debug.reviewElements = parsed.length;
  debug.withStars = parsed.filter((review) => review.stars !== null).length;
  debug.withText = parsed.filter((review) => review.text).length;
  if (previous && previous !== reviewsTab) previous.click();
  if (box) {
    // Maps re-renders the overview after the tab switch and resets the scroll position.
    await new Promise((resolve) => setTimeout(resolve, options.restore ?? 300));
    box.scrollTop = scrollTop;
  }
  return { histogram, reviews, signedOut, debug };
}

// Shows one review in the Google Maps panel: opens the reviews tab, sorts by lowest
// rating, scrolls until the review is loaded, scrolls it into view and flashes it.
export async function revealReview(doc, id, options = {}) {
  const find = () => reviewElements(doc).find((element) => element.getAttribute('data-review-id') === id) || null;
  let element = find();
  if (!element) {
    const tab = findReviewsTab(doc);
    if (!tab) return false;
    tab.click();
    const sort = await waitFor(() => findSort(doc), { ...options, timeout: Math.min(options.timeout ?? 4000, 2000) });
    if (sort && !doc.querySelector(SEL.signIn)) await sortLowest(doc, sort, options);
    await waitFor(() => doc.querySelector(SEL.review), options);
    await scrollUntil(doc, scroller(tab), options, { done: () => Boolean(find()), maxLoads: MAX_REVEAL_LOADS });
    element = find();
  }
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.add('hr-flash');
  setTimeout(() => element.classList.remove('hr-flash'), 2500);
  return true;
}
