import { renderStars } from './stars.js';

const ID = 'hr-overlay';

export function removeOverlay() {
  document.getElementById(ID)?.remove();
}

function paragraph(className, text) {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

function summaryRow(summary) {
  const row = document.createElement('div');
  row.className = 'hr-overlay__summary';
  const note = summary.exact
    ? `${summary.bad.toLocaleString('en-US')} of ${summary.total.toLocaleString('en-US')} reviews are 1-2 stars`
    : 'Estimated from the average rating';
  row.append(renderStars(summary.stars), paragraph('hr-overlay__note', note));
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
export function showOverlay({ title, summary, reviews, loading = false, signedOut = false }) {
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

  if (loading) {
    panel.append(paragraph('hr-overlay__note', 'Loading the worst reviews…'));
  } else {
    if (summary) panel.append(summaryRow(summary));
    if (signedOut) panel.append(paragraph('hr-overlay__note', 'Sign in to Google Maps to see the worst reviews.'));
    else if (reviews.length === 0) panel.append(paragraph('hr-overlay__note', 'No bad reviews with text found.'));
    for (const review of reviews) panel.append(reviewCard(review));
  }
  document.body.append(panel);
  return panel;
}
