/**
 * KATA Architecture - Authentication API Integration Tests
 *
 * Story BK-166: sign in with email and password.
 * Covers the session read (GET /v1/me) and the invalid-credentials ATC (BK-312).
 *
 * Project: integration (depends on api-setup)
 */

import { faker } from '@faker-js/faker';
import { config, expect, test } from '@TestFixture';

test.describe('BK-166: Authentication API', () => {
  /**
   * The Bearer token is loaded from api-state.json by the api fixture.
   * Read-only verification through a helper (not an ATC).
   */
  test('BK-166: should return the current user when the token is valid', { tag: ['@critical'] }, async ({ api }) => {
    const [response, me] = await api.auth.getCurrentUser();

    expect(response.status()).toBe(200);
    expect(me.user.email).toBe(config.testUser.email);
    expect(me.workspaces.length).toBeGreaterThan(0);
  });

  test('BK-166: should reject the session read when no token is sent', async ({ api }) => {
    api.clearAuthToken();

    const [response] = await api.auth.getCurrentUser();

    expect(response.status()).toBe(401);
  });

  test('BK-166: should reject sign in when the password is wrong', async ({ api }) => {
    // Runs ATC BK-312: asserts 401 + 'unauthorized' envelope and no session created
    await api.auth.loginWithInvalidCredentials({
      email: config.testUser.email,
      password: faker.internet.password({ length: 16 }),
    });
  });

  test('BK-166: should reject sign in when the email is unknown', async ({ api }) => {
    // Same uniform 401: the API never reveals whether the email exists
    await api.auth.loginWithInvalidCredentials({
      email: faker.internet.email({ provider: 'example.com' }),
      password: faker.internet.password({ length: 16 }),
    });
  });
});
