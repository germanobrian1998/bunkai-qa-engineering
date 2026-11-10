/**
 * KATA Architecture - Layer 3: Auth API Component
 *
 * API component for authentication operations.
 * Handles login, token management, and user info retrieval.
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple GET. Read-only operations are helpers (no @atc).
 *
 * Endpoints:
 * - POST /api/v1/auth/signin - Sign in; returns Supabase session + a freshly minted PAT
 * - GET /api/v1/me - Current user, workspaces and auth source (requires Bearer)
 */

import type { APIResponse } from '@playwright/test';
import type { MeResponse, SigninRequest, SigninResponse } from '@schemas/auth.types';
import type { ErrorEnvelope } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from AuthApi
export type { MeResponse, SigninRequest, SigninResponse } from '@schemas/auth.types';

// ============================================
// Auth API Component
// ============================================

export class AuthApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Read-only operations (no @atc)
  // ============================================

  /**
   * Helper: Get current authenticated user info.
   *
   * Read-only GET — used as a verification step inside ATCs
   * or for test-level assertions. Not an ATC because it's
   * just a data retrieval, not a complete action flow.
   *
   * @returns Tuple with response and user info
   */
  @step
  async getCurrentUser(): Promise<[APIResponse, MeResponse]> {
    const [response, body] = await this.apiGET<MeResponse>(this.config.auth.meEndpoint);
    return [response, body];
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Authenticate with valid credentials - expects success (200)
   *
   * Complete flow:
   * 1. POST credentials to /v1/auth/signin, requesting a 1-day PAT (ACTION)
   * 2. Validate session + PAT in the response
   * 3. GET /v1/me with the PAT as Bearer to confirm it is usable (VERIFICATION)
   *
   * The PAT (bk_pat_*) is set as the Bearer token for subsequent API requests.
   *
   * @param credentials - Email and password
   * @returns Tuple with response, signin body, and sent payload
   */
  @atc('BK-311')
  async authenticateSuccessfully(
    credentials: Pick<SigninRequest, 'email' | 'password'>,
  ): Promise<[APIResponse, SigninResponse, SigninRequest]> {
    // ACTION: POST signin (every signin mints a PAT, so keep it short-lived)
    const [response, body, sentPayload] = await this.apiPOST<SigninResponse, SigninRequest>(
      this.config.auth.loginEndpoint,
      { ...credentials, pat_name: 'kata-api-setup', pat_expires_in_days: 1 },
    );

    // Fixed assertions - validates successful authentication
    expect(response.status()).toBe(200);
    expect(typeof body.session.access_token).toBe('string');
    expect(body.session.access_token.length).toBeGreaterThan(0);
    expect(typeof body.pat.token).toBe('string');
    expect(body.pat.token.length).toBeGreaterThan(0);

    // Store the PAT as Bearer for subsequent requests
    this.setAuthToken(body.pat.token);

    // VERIFICATION: Confirm the PAT is valid via GET /v1/me
    const [meResponse, meBody] = await this.getCurrentUser();
    expect(meResponse.status()).toBe(200);
    expect(meBody.user.email).toBe(credentials.email);

    return [response, body, sentPayload];
  }

  /**
   * ATC: Login with invalid credentials - expects error (401)
   *
   * Complete flow:
   * 1. POST invalid credentials to /v1/auth/signin (ACTION)
   * 2. Validate 401 + ErrorEnvelope (code 'unauthorized')
   * 3. GET /v1/me without a token to confirm NO session was created (VERIFICATION)
   *
   * @param credentials - Invalid email or password
   * @returns Tuple with error response, error envelope and sent payload
   */
  @atc('BK-312')
  async loginWithInvalidCredentials(
    credentials: Pick<SigninRequest, 'email' | 'password'>,
  ): Promise<[APIResponse, ErrorEnvelope, SigninRequest]> {
    // ACTION: POST invalid credentials
    const [response, body, sentPayload] = await this.apiPOST<ErrorEnvelope, SigninRequest>(
      this.config.auth.loginEndpoint,
      { ...credentials, pat_expires_in_days: 1 },
    );

    // Fixed assertions - uniform 401 that never leaks whether the email exists
    expect(response.status()).toBe(401);
    expect(response.ok()).toBe(false);
    expect(body.error.code).toBe('unauthorized');

    // VERIFICATION: Confirm no session was created via GET /v1/me -> 401
    const savedToken = this.authToken;
    this.clearAuthToken();
    const [meResponse] = await this.getCurrentUser();
    expect(meResponse.status()).toBe(401);
    // Restore token if one existed before this ATC
    if (savedToken) {
      this.setAuthToken(savedToken);
    }

    return [response, body, sentPayload];
  }
}
