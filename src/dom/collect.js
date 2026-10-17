import { SEL, SORT_LOWEST_INDEX, REVIEWS_TAB } from './selectors.js';
import { parseHistogram, worstReviews } from './parse.js';

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

// Opens the reviews tab, sorts by lowest rating and reads the histogram and the
// worst reviews with text. Returns { histogram, reviews } or null. The previous
// tab is restored afterwards so the panel looks as the user left it.
export async function collect(doc, options = {}) {
  const reviewsTab = findReviewsTab(doc);
  if (!reviewsTab) return null;
  const previous = [...doc.querySelectorAll(SEL.tab)].find((tab) => tab.getAttribute('aria-selected') === 'true');
  reviewsTab.click();
  const histogram = await waitFor(() => parseHistogram(doc), options);
  const sort = await waitFor(() => doc.querySelector(SEL.sortButton), options);
  const signedOut = Boolean(doc.querySelector(SEL.signIn));
  let reviews = [];
  // Sorting needs a Google login; signed out, Maps would only show a sign-in dialog.
  if (sort && !signedOut) {
    sort.click();
    const option = await waitFor(() => doc.querySelectorAll(SEL.sortOption)[SORT_LOWEST_INDEX], options);
    if (option) {
      option.click();
      await waitFor(() => doc.querySelector(SEL.review), options);
      // Give Maps a moment to re-render the list in the new order.
      await new Promise((resolve) => setTimeout(resolve, options.settle ?? 600));
      reviews = worstReviews(doc);
    }
  }
  if (previous && previous !== reviewsTab) previous.click();
  return { histogram, reviews, signedOut };
}
