import { renderStars } from './stars.js';

export const BADGE_ATTR = 'data-hr-badge';

// Purple stars plus the number of bad reviews; "~" marks an estimate.
export function renderBadge(summary) {
  const badge = document.createElement('span');
  badge.className = 'hr-badge';
  badge.setAttribute(BADGE_ATTR, '');
  badge.append(renderStars(summary.stars));
  if (summary.bad !== null) {
    const count = document.createElement('span');
    count.className = 'hr-badge__count';
    count.textContent = `${summary.exact ? '' : '~'}${summary.bad.toLocaleString('en-US')} bad`;
    badge.append(count);
  }
  return badge;
}
