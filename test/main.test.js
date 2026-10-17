import { expect, it } from 'vitest';

it('starts the app when the content script loads', async () => {
  window.history.replaceState({}, '', '/maps/place/Cafe/@1,2,3z');
  document.body.innerHTML = '<div role="main"><h1>Cafe</h1></div>';
  await import('../src/main.js');
  expect(document.getElementById('hr-overlay')).not.toBeNull();
  window.history.replaceState({}, '', '/');
});
