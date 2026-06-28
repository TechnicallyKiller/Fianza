import { defineConfig } from 'vitest/config';

export default defineConfig({
  envFile: false,
  test: {
    globals: true,
    environment: 'node',
    reporters: ['./vitest-green-tick-reporter.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'scripts/',
        '**/*.test.js',
        '**/*.config.js',
      ],
    },
    testTimeout: 30000, // 30 seconds for blockchain operations
  },
});
