import { renderStars } from './stars.js';

export const SECTION_CLASS = 'hr-menu-section';

function row(rank, current, onPick) {
  const item = document.createElement('div');
  item.className = 'hr-menu-item';
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', String(rank === current));
  const label = `${rank} negative ${rank === 1 ? 'star' : 'stars'}: Google rating ${5 - rank}.0 or higher`;
  item.setAttribute('aria-label', label);
  item.title = label;
  item.tabIndex = 0;
  item.append(renderStars(rank));
  item.addEventListener('click', () => onPick(rank));
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPick(rank);
    }
  });
  return item;
}

// Appends a "Negative" section to the item list of the original Maps rating
// menu: three rows of purple stars. 1 negative star lists places with a Google
// rating below 5.0, 2 below 4.0, 3 below 3.0. Current 0 means no negative row is
// picked (the Maps view).
export function enhanceRatingMenu(list, current, onPick) {
  const section = document.createElement('div');
  section.className = SECTION_CLASS;
  const heading = document.createElement('div');
  heading.className = 'hr-menu-heading';
  heading.textContent = 'Negative';
  section.append(heading, ...[1, 2, 3].map((rank) => row(rank, current, onPick)));
  list.append(section);
  return section;
}
