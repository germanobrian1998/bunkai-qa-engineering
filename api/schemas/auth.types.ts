/**
 * KATA Framework - Type Facade: Auth Domain
 *
 * Type definitions for authentication endpoints, derived from @openapi.
 *
 * Consumed by: tests/components/api/AuthApi.ts
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Bunkai facades (derived from @openapi)
// ============================================================================

type SigninPath = paths['/api/v1/auth/signin']['post'];
type MePath = paths['/api/v1/me']['get'];

/** Request body for POST /api/v1/auth/signin */
export type SigninRequest = SigninPath['requestBody']['content']['application/json'];

/** Successful response (200) of POST /api/v1/auth/signin */
export type SigninResponse = SigninPath['responses']['200']['content']['application/json'];

/** Supabase session returned by sign-in */
export type SigninSession = SigninResponse['session'];

/** Freshly-minted Personal Access Token returned by sign-in */
export type SigninPat = SigninResponse['pat'];

/** Successful response (200) of GET /api/v1/me */
export type MeResponse = MePath['responses']['200']['content']['application/json'];

/** Workspace summary entry inside MeResponse */
export type MeWorkspace = MeResponse['workspaces'][number];

/** Schema alias kept for cross-reference with components['schemas'] */
export type SigninBody = components['schemas']['SigninBody'];
