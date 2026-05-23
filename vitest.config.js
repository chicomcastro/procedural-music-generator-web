import { defineConfig } from 'vitest/config';

// Vitest is intentionally lean: tests live under /test, run in Node, and use
// the v8 coverage provider so we can publish line/branch/fn % per PR.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    // jsdom for the handful of tests that touch DOM (Sidebar nav, i18n
    // language switch on a <html lang> root). Most tests run fine in node
    // and just ignore jsdom.
    environment: 'jsdom',
    setupFiles: ['./test/setup/dom-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/js/**/*.js'],
      // The build script + scratch helpers don't ship to users, skip them.
      exclude: [
        'src/js/main.js',
        'src/js/**/*.d.ts',
        'src/js/**/__mocks__/**',
        'scripts/**',
        'test/**',
      ],
      // Allow these to slide for the first wave of coverage work. The CI
      // sticky comment surfaces the % per PR so we can track progression
      // without the build blowing up below the bar.
      thresholds: {
        lines: 0,
        functions: 0,
        statements: 0,
        branches: 0,
      },
    },
  },
});
