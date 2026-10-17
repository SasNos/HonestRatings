import { expect, it } from 'vitest';

it('starts the app when the content script loads', async () => {
  document.body.innerHTML = '<div role="feed"><div role="article"><span role="img" aria-label="4.0 stars 100 Reviews"></span></div></div>';
  await import('../src/main.js');
  expect(document.querySelector('[data-hr-badge]')).not.toBeNull();
});
