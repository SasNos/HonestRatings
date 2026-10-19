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
  if (summary.bad !== null)
    text += ` (${tilde}${summary.bad.toLocaleString('en-US')} / ${summary.total.toLocaleString('en-US')})`;
  const figures = document.createElement('div');
  figures.append(paragraph('hr-overlay__figure', text));
  if (summary.average !== null)
    figures.append(paragraph('hr-overlay__note', `Google rating ${summary.average.toFixed(1)}`));
  row.append(renderStars(summary.stars), figures);
  return row;
}

// A click (or Enter) on a review shows it in the Google Maps panel.
function reviewCard(review, onReview) {
  const card = document.createElement('article');
  card.className = 'hr-review';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.title = 'Show this review in Google Maps';
  const meta = document.createElement('div');
  meta.className = 'hr-review__meta';
  const author = document.createElement('span');
  author.textContent = review.author || 'Anonymous';
  meta.append(author, renderStars(review.stars));
  const text = paragraph('hr-review__text', review.text || 'No text');
  if (!review.text) text.classList.add('hr-review__text--empty');
  card.append(meta, text);
  card.addEventListener('click', () => onReview(review));
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onReview(review);
    }
  });
  return card;
}

// Panel on the right of the map with the negative reviews of the open place.
// While reviews are still loading it can be shown again with what is there so far.
export function showOverlay({
  title,
  summary,
  reviews = [],
  loading = false,
  signedOut = false,
  debug = null,
  onReview = () => {},
}) {
  const previous = document.getElementById(ID);
  const scrollTop = previous ? previous.scrollTop : 0;
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
  if (loading) panel.append(paragraph('hr-overlay__note', 'Loading the negative reviews…'));
  else if (signedOut)
    panel.append(paragraph('hr-overlay__note', 'Sign in to Google Maps to see the negative reviews.'));
  else if (reviews.length === 0) panel.append(paragraph('hr-overlay__note', 'No negative reviews found.'));
  if (reviews.length > 0)
    panel.append(
      paragraph(
        'hr-overlay__note',
        `${reviews.length} negative ${reviews.length === 1 ? 'review' : 'reviews'} (1-2 stars), 1 star first`,
      ),
    );
  for (const review of reviews) panel.append(reviewCard(review, onReview));
  if (!loading && debug && reviews.length === 0 && !signedOut) {
    const found = (flag) => (flag ? 'found' : 'missing');
    panel.append(
      paragraph(
        'hr-overlay__debug',
        `Debug: sort button ${found(debug.sort)}, ${debug.options} menu items, ${debug.reviewElements} review elements, histogram ${histogramText(debug.histogram)}, ${debug.withStars} with stars, ${debug.withText} with text`,
      ),
    );
  }
  document.body.append(panel);
  panel.scrollTop = scrollTop;
  return panel;
}
