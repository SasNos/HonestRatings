import { renderStars } from './stars.js';

export const MENU_ATTR = 'data-hr-menu';

function row(max, current, onPick) {
  const item = document.createElement('div');
  item.className = 'hr-menu-item';
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', String(max === current));
  item.setAttribute('aria-label', max === 5 ? 'Any number of negative stars' : `Up to ${max} negative stars`);
  item.tabIndex = 0;
  item.append(renderStars(max));
  item.addEventListener('click', () => onPick(max));
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPick(max);
    }
  });
  return item;
}

// Appends a "Negative" section to the item list of the original Maps rating
// menu: five rows of purple stars, the picked one is the most negative stars a
// place may have (5 = any).
export function enhanceRatingMenu(list, current, onPick) {
  const section = document.createElement('div');
  section.className = 'hr-menu-section';
  const heading = document.createElement('div');
  heading.className = 'hr-menu-heading';
  heading.textContent = 'Negative';
  section.append(heading, ...[1, 2, 3, 4, 5].map((max) => row(max, current, onPick)));
  list.append(section);
  return section;
}
