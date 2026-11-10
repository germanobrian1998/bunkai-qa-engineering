/**
 * KATA Architecture - API Auth Setup (Project)
 *
 * Authenticates via API directly using AuthApi.authenticateSuccessfully() ATC.
 * Generates a JWT token for use by Integration tests.
 *
 * Dependencies: global-setup
 * Dependents: integration
 */

import type { ApiState } from '@data/types';

import { statSync, writeFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { test as setup } from '@TestFixture';
import { attachRequestResponseToAllure } from '@utils/allure';
import { config } from '@variables';

const apiStateFile = config.auth.apiStatePath;

/**
 * API Authentication Setup
 *
 * 1. Uses AuthApi.authenticateSuccessfully() ATC
 * 2. Saves token to api-state.json for integration tests
 */
setup('API Setup: authenticate via API', async ({ api }) => {
  console.log('[API Setup] Starting API authentication...');
  console.log(`[API Setup] Target: ${config.apiUrl}${config.auth.loginEndpoint}`);

  // Use AuthApi ATC
  const credentials = {
    email: config.testUser.email,
    password: config.testUser.password,
  };
  const [response, tokenData] = await api.auth.authenticateSuccessfully(credentials);

  // Attach to Allure for debugging
  await attachRequestResponseToAllure({
    url: response.url(),
    method: 'POST',
    responseBody: { ...tokenData, session: '***', pat: '***' },
    requestBody: { email: credentials.email, password: '***' },
  });

  console.log('[API Setup] Authentication successful');
  console.log(`[API Setup] PAT expires at: ${tokenData.pat.expires_at}`);

  // Save the PAT (Bearer credential for the API) for use by integration tests
  const apiState: ApiState = {
    token: tokenData.pat.token,
    tokenType: 'Bearer',
    expiresIn: Math.max(0, (tokenData.session.expires_at ?? 0) - Math.floor(Date.now() / 1000)),
    refreshToken: tokenData.session.refresh_token ?? null,
    source: 'api-login',
    createdAt: new Date().toISOString(),
  };

  writeFileSync(apiStateFile, JSON.stringify(apiState, null, 2));
  expect(statSync(apiStateFile).size).toBeGreaterThan(0);
  console.log(`[API Setup] Token saved to ${apiStateFile}`);
});
