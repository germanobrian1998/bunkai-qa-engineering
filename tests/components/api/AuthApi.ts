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
 * - POST /api/v1/tokens, DELETE /api/v1/tokens/{id} - Personal Access Tokens (cookie session only)
 */

import type { APIResponse } from '@playwright/test';
import type { MeResponse, SigninRequest, SigninResponse } from '@schemas/auth.types';
import type { CreateTokenBody, CreateTokenResponse, ErrorEnvelope, ListTokensResponse } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from AuthApi
export type { MeResponse, SigninRequest, SigninResponse } from '@schemas/auth.types';

// Signin carries the password and returns session + PAT secrets: mask them (nested keys included) in Allure
const SIGNIN_REDACT_KEYS = ['password', 'access_token', 'refresh_token', 'token'];

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

  /**
   * Helper: Sign in to open a cookie session on this request context.
   *
   * Unlike authenticateSuccessfully this does NOT set the PAT as Bearer: the
   * caller keeps the cookie session (storageState) and the Supabase access
   * token. Setup-only; every signin mints a 1-day PAT as a side effect.
   *
   * @returns Tuple with response and signin body
   */
  @step
  async signInForSession(
    credentials: Pick<SigninRequest, 'email' | 'password'>,
  ): Promise<[APIResponse, SigninResponse]> {
    const [response, body] = await this.apiPOST<SigninResponse, SigninRequest>(
      this.config.auth.loginEndpoint,
      { ...credentials, pat_name: 'kata-role-session', pat_expires_in_days: 1 },
      { redactKeys: SIGNIN_REDACT_KEYS },
    );
    expect(response.status()).toBe(200);
    expect(body.session.access_token.length).toBeGreaterThan(0);
    return [response, body];
  }

  /**
   * Helper: Mint a Personal Access Token with the caller's cookie session.
   *
   * Setup mutation, deliberately a step and not an ATC (no signed TC owns it).
   * The route refuses a Bearer credential, so use a request context without one.
   *
   * @param args - Scopes, optional workspace binding and lifetime in days
   * @returns Tuple with response, created token (secret shown once) and sent payload
   */
  @step
  async provisionToken(
    args: { scopes: CreateTokenBody['scopes'], workspaceId?: string, expiresInDays: number, name?: string },
  ): Promise<[APIResponse, CreateTokenResponse, CreateTokenBody]> {
    const payload: CreateTokenBody = {
      name: args.name ?? 'kata-bk572-fixture',
      scopes: args.scopes,
      expires_in_days: args.expiresInDays,
      ...(args.workspaceId ? { workspace_id: args.workspaceId } : {}),
    };
    // The response carries the raw PAT: keep it out of the Allure attachments
    const [response, body, sentPayload] = await this.apiPOST<CreateTokenResponse, CreateTokenBody>(
      '/v1/tokens',
      payload,
      { redactKeys: ['token'] },
    );
    expect(response.status()).toBe(201);
    return [response, body, sentPayload];
  }

  /**
   * Helper: List the caller's Personal Access Tokens (no secrets, revoked ones included).
   *
   * @returns Tuple with response and token list body
   */
  @step
  async listTokens(): Promise<[APIResponse, ListTokensResponse]> {
    const [response, body] = await this.apiGET<ListTokensResponse>('/v1/tokens');
    expect(response.status()).toBe(200);
    return [response, body];
  }

  /**
   * Helper: Revoke a Personal Access Token by id (teardown of provisionToken).
   * A 404 means it is already gone, which is the state a teardown wants.
   *
   * @param tokenId - Token UUID
   * @returns Tuple with response and body (empty on 204)
   */
  @step
  async revokeToken(tokenId: string): Promise<[APIResponse, Record<string, unknown>]> {
    const [response, body] = await this.apiDELETE(`/v1/tokens/${tokenId}`);
    expect([200, 204, 404]).toContain(response.status());
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
      { redactKeys: SIGNIN_REDACT_KEYS },
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
