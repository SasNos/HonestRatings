import { renderStars } from './stars.js';

const ID = 'hr-overlay';

export function removeOverlay() {
  document.getElementById(ID)?.remove();
}

function histogramText(histogram) {
  return histogram ? [5, 4, 3, 2, 1].map((star) => `${star}:${histogram[star]}`).join(' ') : 'not found';
}

function paragraph(className, text) {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

function formatPercent(share) {
  const percent = share * 100;
  return percent < 10 ? percent.toFixed(1).replace(/\.0$/, '') : String(Math.round(percent));
}

// "20% (200 / 1,000)", with "~" in front of every estimated number.
function summaryRow(summary) {
  const row = document.createElement('div');
  row.className = 'hr-overlay__summary';
  const tilde = summary.exact ? '' : '~';
  let text = `${tilde}${formatPercent(summary.share)}%`;
  if (summary.bad !== null) text += ` (${tilde}${summary.bad.toLocaleString('en-US')} / ${summary.total.toLocaleString('en-US')})`;
  const figures = document.createElement('div');
  figures.append(paragraph('hr-overlay__figure', text));
  if (summary.average !== null) figures.append(paragraph('hr-overlay__note', `Google rating ${summary.average.toFixed(1)}`));
  row.append(renderStars(summary.stars), figures);
  return row;
}

function reviewCard(review) {
  const card = document.createElement('article');
  card.className = 'hr-review';
  const meta = document.createElement('div');
  meta.className = 'hr-review__meta';
  const author = document.createElement('span');
  author.textContent = review.author || 'Anonymous';
  meta.append(author, renderStars(review.stars));
  card.append(meta, paragraph('hr-review__text', review.text));
  return card;
}

// Top-right panel with the worst reviews of the open place.
export function showOverlay({ title, summary, reviews, loading = false, signedOut = false, debug = null }) {
  removeOverlay();
  const panel = document.createElement('aside');
  panel.id = ID;
  panel.className = 'hr-overlay';
  panel.setAttribute('aria-label', 'Honest Ratings');

  const header = document.createElement('header');
  header.className = 'hr-overlay__header';
  const heading = document.createElement('h2');
  heading.textContent = 'Honest Ratings';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'hr-overlay__close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  close.addEventListener('click', () => panel.remove());
  header.append(heading, close);
  panel.append(header, paragraph('hr-overlay__place', title));

  if (summary) panel.append(summaryRow(summary));
  if (loading) {
    panel.append(paragraph('hr-overlay__note', 'Loading the worst reviews…'));
  } else {
    if (signedOut) panel.append(paragraph('hr-overlay__note', 'Sign in to Google Maps to see the worst reviews.'));
    else if (reviews.length === 0) panel.append(paragraph('hr-overlay__note', 'No bad reviews with text found.'));
    if (reviews.length > 0) panel.append(paragraph('hr-overlay__note', `${reviews.length} negative ${reviews.length === 1 ? 'review' : 'reviews'} (1-2 stars) with text`));
    for (const review of reviews) panel.append(reviewCard(review));
    if (debug && reviews.length === 0 && !signedOut) {
      const found = (flag) => (flag ? 'found' : 'missing');
      panel.append(paragraph('hr-overlay__debug', `Debug: sort button ${found(debug.sort)}, ${debug.options} menu items, ${debug.reviewElements} review elements, histogram ${histogramText(debug.histogram)}, ${debug.withStars} with stars, ${debug.withText} with text`));
    }
  }
  document.body.append(panel);
  return panel;
}
