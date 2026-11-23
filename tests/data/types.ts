/**
 * KATA Architecture - Test Data Types
 *
 * Types for test data generation and fixture state.
 * These are TEST-ONLY concepts — NOT API contract types.
 *
 * API contract types (request/response schemas) belong in:
 *   api/schemas/{domain}.types.ts → import from '@schemas/{domain}.types'
 */

import type { RunReportItem } from '@schemas/runs.types';

// ============================================
// Generic Types
// ============================================

export interface TestUser {
  email: string
  password: string
  name: string
  firstName?: string
  lastName?: string
}

export interface TestCredentials {
  email: string
  password: string
}

// ============================================
// Project-Specific Types
// ============================================

export interface TestWorkspace {
  name: string
  slug: string
}

// ============================================
// Auth/Fixture State Types
// ============================================

/**
 * Stored API state for test fixtures
 * Used by setup files and TestFixture for token propagation
 */
export interface ApiState {
  token: string
  tokenType: string
  expiresIn: number
  refreshToken: string | null
  source: 'ui-login' | 'api-login'
  createdAt: string
}

export type RunExecutor = RunReportItem['executor_mode'];
export type RunOutcome = RunReportItem['status'];
export type RunVerdicts = Partial<Record<RunOutcome, number>>;
export type RunRecipe = Partial<Record<RunExecutor, RunVerdicts>>;

export interface FixtureProject {
  id: string
  slug: string
  workspaceId: string
}

export interface TestLifecycleArena {
  workspaceId: string
  project: FixtureProject
  atcId: string
}

export interface SeededTest {
  id: string
  title: string
  version: number
}
