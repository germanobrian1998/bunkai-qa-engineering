/**
 * KATA Architecture - Layer 4: API Fixture
 *
 * Dependency Injection container for all API components.
 * Provides unified access to API testing capabilities.
 *
 * All API components share the same request context from TestContext,
 * ensuring consistent authentication and request configuration.
 *
 * HOW TO ADD NEW API COMPONENTS:
 * 1. Create your component in tests/components/api/YourApi.ts
 * 2. Import it here
 * 3. Add as readonly property
 * 4. Initialize in constructor passing the options
 */

import type { TestContextOptions } from '@TestContext';

import { ActivityApi } from '@api/ActivityApi';
import { ApiBase } from '@api/ApiBase';
import { AuthApi } from '@api/AuthApi';
import { BugApi } from '@api/BugApi';
import { InviteApi } from '@api/InviteApi';
import { WorkspaceApi } from '@api/WorkspaceApi';

// ============================================
// API Fixture Class
// ============================================

export class ApiFixture extends ApiBase {
  /** Auth component - handles login and token management */
  readonly auth: AuthApi;

  /** Workspace component - read helpers for the tenant entity */
  readonly workspace: WorkspaceApi;

  /** Invite component - issue and accept invitations (setup helpers) */
  readonly invite: InviteApi;

  /** Bug component - hold, assign and read Bugs */
  readonly bug: BugApi;

  /** Activity component - activity feed and notifications inbox reads */
  readonly activity: ActivityApi;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same request context)
    this.auth = new AuthApi(options);
    this.workspace = new WorkspaceApi(options);
    this.invite = new InviteApi(options);
    this.bug = new BugApi(options);
    this.activity = new ActivityApi(options);
  }

  // ============================================
  // Token Propagation to Child Components
  // ============================================

  /**
   * Set authentication token for all API components.
   * This ensures all components use the same token for authenticated requests.
   */
  override setAuthToken(token: string) {
    super.setAuthToken(token);
    this.auth.setAuthToken(token);
    this.workspace.setAuthToken(token);
    this.invite.setAuthToken(token);
    this.bug.setAuthToken(token);
    this.activity.setAuthToken(token);
  }

  /**
   * Clear authentication token from all API components.
   */
  override clearAuthToken() {
    super.clearAuthToken();
    this.auth.clearAuthToken();
    this.workspace.clearAuthToken();
    this.invite.clearAuthToken();
    this.bug.clearAuthToken();
    this.activity.clearAuthToken();
  }
}
