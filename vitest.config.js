import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // The app tests run whole collections with real timers; on a busy machine one takes several seconds.
    testTimeout: 15000,
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js', 'tools/tokens.mjs'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
