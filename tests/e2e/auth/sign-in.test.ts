/**
 * KATA Architecture - Sign in UI E2E Tests
 *
 * Story BK-166: sign in with email and password.
 *
 * Project: e2e (depends on ui-setup, which saves the storage state)
 */

import { DataFactory } from '@DataFactory';
import { config, test } from '@TestFixture';

test.describe('BK-166: Sign in UI', () => {
  test('BK-166: should land on projects when a saved session is restored', { tag: ['@critical'] }, async ({ ui }) => {
    await ui.login.verifySessionRestored();
  });

  test.describe('without a saved session', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('BK-166: should show an error when the password is wrong', async ({ ui }) => {
      await ui.login.goto();

      // Runs ATC BK-314: error banner visible and the user stays on /login
      await ui.login.loginWithInvalidCredentials(DataFactory.createCredentials({ email: config.testUser.email }));
    });
  });
});
