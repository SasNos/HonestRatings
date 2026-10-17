import { SEL, SORT_LOWEST_INDEX, SORT_LABEL, REVIEWS_TAB } from './selectors.js';
import { parseHistogram, parseReview, reviewElements, worstReviews } from './parse.js';

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
  return [...doc.querySelectorAll(SEL.sortCandidate)].find((el) => SORT_LABEL.test(el.getAttribute('aria-label') || el.textContent.slice(0, 40))) || null;
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

// Opens the reviews tab, sorts by lowest rating and reads the histogram and the
// worst reviews with text. Returns { histogram, reviews } or null. The previous
// tab is restored afterwards so the panel looks as the user left it.
export async function collect(doc, options = {}) {
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
  let reviews = [];
  // Sorting needs a Google login; signed out, Maps would only show a sign-in dialog.
  if (sort && !signedOut) {
    press(sort);
    const option = await waitFor(() => doc.querySelectorAll(SEL.sortOption)[SORT_LOWEST_INDEX], options);
    debug.options = doc.querySelectorAll(SEL.sortOption).length;
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
      reviews = worstReviews(doc);
    }
  }
  if (reviews.length === 0) {
    // No sorting possible: the worst of the reviews Maps loaded is still useful.
    await waitFor(() => doc.querySelector(SEL.review), options);
    reviews = worstReviews(doc);
  }
  if (previous && previous !== reviewsTab) previous.click();
  if (box) {
    // Maps re-renders the overview after the tab switch and resets the scroll position.
    await new Promise((resolve) => setTimeout(resolve, options.restore ?? 300));
    box.scrollTop = scrollTop;
  }
  const parsed = reviewElements(doc).map(parseReview);
  debug.reviewElements = parsed.length;
  debug.withStars = parsed.filter((review) => review.stars !== null).length;
  debug.withText = parsed.filter((review) => review.text).length;
  return { histogram, reviews, signedOut, debug };
}
