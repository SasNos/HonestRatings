import { renderStars } from './stars.js';

export const SECTION_CLASS = 'hr-menu-section';

function row(min, current, onPick) {
  const item = document.createElement('div');
  item.className = 'hr-menu-item';
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', String(min === current));
  item.setAttribute('aria-label', min === 1 ? 'Any number of negative stars' : `At least ${min} negative stars`);
  item.tabIndex = 0;
  item.append(renderStars(min));
  item.addEventListener('click', () => onPick(min));
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPick(min);
    }
  });
  return item;
}

// Appends a "Negative" section to the item list of the original Maps rating
// menu: five rows of purple stars, the picked one is the fewest negative stars a
// place may have (1 = any), like the "2.0+" rows above it but the other way round.
export function enhanceRatingMenu(list, current, onPick) {
  const section = document.createElement('div');
  section.className = SECTION_CLASS;
  const heading = document.createElement('div');
  heading.className = 'hr-menu-heading';
  heading.textContent = 'Negative';
  section.append(heading, ...[1, 2, 3, 4, 5].map((min) => row(min, current, onPick)));
  list.append(section);
  return section;
}
