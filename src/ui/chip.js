import { renderStars } from './stars.js';

function span(className, text) {
  const element = document.createElement('span');
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

// Dropdown chip "Negative": pick the maximum number of negative stars a place
// may have. Calls onChange(max) with 1-5, where 5 means "any".
export function createChip(onChange) {
  const root = document.createElement('div');
  root.className = 'hr-chip';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hr-chip__button';
  button.setAttribute('aria-haspopup', 'listbox');
  const menu = document.createElement('ul');
  menu.className = 'hr-chip__menu';
  menu.setAttribute('role', 'listbox');
  let current = 5;

  const setOpen = (open) => {
    if (open) {
      // The chip row of Maps clips its children, so the menu lives in the body.
      const box = button.getBoundingClientRect();
      menu.style.top = `${box.bottom + 4}px`;
      menu.style.left = `${box.left}px`;
      document.body.append(menu);
    }
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  const renderButton = () => {
    const caret = span('hr-chip__caret');
    caret.setAttribute('aria-hidden', 'true');
    button.replaceChildren('Negative', renderStars(current), caret);
  };

  const items = [5, 4, 3, 2, 1].map((max) => {
    const item = document.createElement('li');
    item.setAttribute('role', 'option');
    item.tabIndex = 0;
    item.append(renderStars(max), span('', max === 5 ? 'Any' : `${max} or fewer`));
    item.setAttribute('aria-selected', String(max === current));
    const pick = () => {
      current = max;
      renderButton();
      items.forEach((other) => other.setAttribute('aria-selected', String(other === item)));
      setOpen(false);
      onChange(max);
    };
    item.addEventListener('click', pick);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick();
      }
    });
    return item;
  });
  menu.append(...items);

  button.addEventListener('click', () => setOpen(menu.hidden));
  const onKeydown = (event) => {
    if (event.key === 'Escape') setOpen(false);
  };
  root.addEventListener('keydown', onKeydown);
  menu.addEventListener('keydown', onKeydown);
  document.addEventListener('click', (event) => {
    if (!root.contains(event.target) && !menu.contains(event.target)) setOpen(false);
  });

  setOpen(false);
  renderButton();
  root.append(button, menu);
  return root;
}
