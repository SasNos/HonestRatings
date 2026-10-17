import { SEL, RATING_CHIP } from './dom/selectors.js';
import { parseRatingLabel } from './dom/parse.js';
import { collect } from './dom/collect.js';
import { summarize } from './scoring.js';
import { renderBadge, BADGE_ATTR } from './ui/badge.js';
import { createChip } from './ui/chip.js';
import { showOverlay, removeOverlay } from './ui/overlay.js';

const SCAN_DELAY = 200;

function ratingOf(scope) {
  for (const image of scope.querySelectorAll(SEL.ratingImage)) {
    const rating = parseRatingLabel(image.getAttribute('aria-label'));
    if (rating) return { image, rating };
  }
  return null;
}

export function createApp(doc = document, collectOptions = {}) {
  let maxStars = 5;
  let place = null;
  let run = 0;

  const chip = createChip((max) => {
    maxStars = max;
    decorateCards();
  });

  function decorateCards() {
    for (const card of doc.querySelectorAll(SEL.card)) {
      const found = ratingOf(card);
      if (found && !card.querySelector(`[${BADGE_ATTR}]`)) {
        const summary = summarize({ average: found.rating.average, total: found.rating.total });
        found.image.setAttribute('data-hr-hidden', '');
        found.image.after(renderBadge(summary));
        card.dataset.hrStars = String(summary.stars);
      }
      card.toggleAttribute('data-hr-filtered', Number(card.dataset.hrStars) > maxStars);
    }
  }

  function placeChip() {
    if (chip.isConnected || !doc.querySelector(SEL.card)) return;
    // Maps keeps a hidden duplicate of the chip row, so only a visible button counts.
    const anchor = [...doc.querySelectorAll('button')].find(
      (button) => button.getClientRects().length > 0 && button.textContent.length < 24 && RATING_CHIP.test(button.textContent),
    );
    if (anchor) {
      // Insert next to the chip item, not inside the button's own wrapper.
      let item = anchor;
      while (item.parentElement.children.length === 1) item = item.parentElement;
      item.after(chip);
    } else {
      chip.classList.add('hr-chip--floating');
      doc.body.append(chip);
    }
  }

  async function openPlace(title) {
    const mine = ++run;
    showOverlay({ title, loading: true });
    const data = await collect(doc, collectOptions);
    if (mine !== run) return;
    const panel = ratingOf(doc.querySelector('[role="main"]') || doc);
    const summary = summarize({
      histogram: data?.histogram ?? null,
      average: panel?.rating.average,
      total: panel?.rating.total,
    });
    showOverlay({ title, summary, reviews: data?.reviews ?? [], signedOut: data?.signedOut });
  }

  function trackPlace() {
    // Ads put a "Sponsored" h1 before the title; the results list has its own h1s.
    const titles = [...doc.querySelectorAll(SEL.placeTitle)].filter((h1) => !h1.closest(SEL.feed) && h1.textContent.trim());
    const title = titles.at(-1)?.textContent.trim() || null;
    if (title === place) return;
    place = title;
    run += 1;
    removeOverlay();
    if (title) openPlace(title);
  }

  function scan() {
    placeChip();
    decorateCards();
    trackPlace();
  }

  return { scan };
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
