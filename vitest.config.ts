import { defineConfig } from 'vitest/config';

// Unit tests run against pure logic only (utils/services with no React Native
// runtime deps). Scoped to *.test.ts under src/ and a node environment so the
// runner never pulls in the RN/Expo module graph — those need jest-expo, which
// we deliberately don't set up here.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
