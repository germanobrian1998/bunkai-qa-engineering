/**
 * KATA Architecture - Sign in UI E2E Tests
 *
 * Story BK-166: sign in with email and password.
 *
 * Project: e2e (depends on ui-setup, which saves the storage state)
 */

import { faker } from '@faker-js/faker';
import { config, expect, test } from '@TestFixture';

test.describe('BK-166: Sign in UI', () => {
  // Raw `page`, deliberately: this asserts INFRASTRUCTURE (ui-setup saved a
  // storage state and Playwright restored it), not a domain flow, so there is
  // no Page component to route through.
  test('BK-166: should land on projects when a saved session is restored', { tag: ['@critical'] }, async ({ page }) => {
    await page.goto('/projects');

    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByTestId('sidebar-search')).toBeVisible();
  });

  test.describe('without a saved session', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('BK-166: should show an error when the password is wrong', async ({ ui }) => {
      await ui.login.goto();

      // Runs ATC BK-314: error banner visible and the user stays on /login
      await ui.login.loginWithInvalidCredentials({
        email: config.testUser.email,
        password: faker.internet.password({ length: 16 }),
      });
    });
  });
});
