const SVG_NS = 'http://www.w3.org/2000/svg';
const STAR_PATH = 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

function star(filled) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('hr-star');
  if (!filled) svg.classList.add('hr-star--empty');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', STAR_PATH);
  svg.append(path);
  return svg;
}

// Five purple stars, `count` of them filled.
export function renderStars(count) {
  const wrap = document.createElement('span');
  wrap.className = 'hr-stars';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `${count} of 5 negative stars`);
  for (let i = 1; i <= 5; i += 1) wrap.append(star(i <= count));
  return wrap;
}
