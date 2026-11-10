/**
 * KATA Architecture - Layer 3: Workspace API Component
 *
 * API component for the Workspace entity (tenant of the Bunkai TMS).
 * Currently exposes read-only helpers; write ATCs (create, update, remove
 * member) are added by /test-automation with their own Jira Test keys.
 *
 * Endpoints:
 * - GET /api/v1/workspaces - Workspaces the caller belongs to (Bearer atc:read)
 * - GET /api/v1/workspaces/{id} - A single workspace (Bearer atc:read)
 */

import type { APIResponse } from '@playwright/test';
import type { GetWorkspaceResponse, ListWorkspacesResponse } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from WorkspaceApi
export type { GetWorkspaceResponse, ListWorkspacesResponse } from '@schemas/workspace.types';

// ============================================
// Workspace API Component
// ============================================

export class WorkspaceApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Read-only operations (no @atc)
  // ============================================

  /**
   * Helper: Get a single workspace by id.
   *
   * @param id - Workspace UUID
   * @returns Tuple with response and workspace body
   */
  @step
  async getWorkspace(id: string): Promise<[APIResponse, GetWorkspaceResponse]> {
    const [response, body] = await this.apiGET<GetWorkspaceResponse>(`/v1/workspaces/${id}`);
    return [response, body];
  }

  /**
   * Helper: List the workspaces the authenticated user belongs to.
   *
   * @returns Tuple with response and workspaces list body
   */
  @step
  async listWorkspaces(): Promise<[APIResponse, ListWorkspacesResponse]> {
    const [response, body] = await this.apiGET<ListWorkspacesResponse>('/v1/workspaces');
    return [response, body];
  }
}
