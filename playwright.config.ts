import { defineConfig, devices } from '@playwright/test';

// E2E: drives the web app (react-native-web) against a real local Supabase
// stack. Bring the backend up with `bash e2e/setup.sh`, boot the web app
// (`npm run web`, see e2e/README.md), then `npm run test:e2e`.
//
// A wide viewport so RootNavigator mounts the desktop shell (>=1024px). Ports
// are env-overridable so a machine running another local stack can remap them.
export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8090',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
