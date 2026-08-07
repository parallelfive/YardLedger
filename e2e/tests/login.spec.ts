import { test, expect } from '@playwright/test';
import { queryOne } from '../lib/db';

// Smoke E2E: the real web UI signs in against the live local Supabase stack.
// Proves the full front-to-back chain up to an authenticated session:
// browser -> react-native-web app -> supabase-js -> local GoTrue -> persisted JWT.
test('owner signs in through the web UI against the live backend', async ({
  page,
}) => {
  await page.goto('/');

  // Wide viewport -> the desktop shell's login form (real DOM inputs).
  await page.locator('input[type="email"]').first().fill('owner@e2e.test');
  await page.locator('input[type="password"]').first().fill('Passw0rd!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The real GoTrue session was established and persisted by supabase-js.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Object.keys(window.localStorage).some((k) => k.includes('auth-token'))
        ),
      { timeout: 20_000 }
    )
    .toBe(true);

  // And we advanced past the login form.
  await expect(page.locator('input[type="email"]')).toHaveCount(0);

  // Assert the BACKEND side too: the account the UI authenticated as is the
  // seeded owner of the E2E tenant (the DB-assertion pattern the golden flows
  // will use to prove UI actions land in the database).
  const owner = await queryOne<{ role: string; name: string }>(
    'select role, name from public.users where email = $1',
    ['owner@e2e.test']
  );
  expect(owner?.role).toBe('owner');
  expect(owner?.name).toBe('E2E Owner');
});
