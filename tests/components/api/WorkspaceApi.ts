/**
 * KATA Architecture - Layer 3: Workspace API Component
 *
 * API component for the Workspace entity (tenant of the Bunkai TMS).
 * Read helpers plus the member-removal ATCs (BK-572). Other write ATCs
 * (create, update) are added by /test-automation with their own Jira Test keys.
 *
 * Endpoints (paths are relative to config.apiUrl, which already ends in /api):
 * - GET /v1/workspaces - Workspaces the caller belongs to (Bearer atc:read)
 * - GET /v1/workspaces/{id} - A single workspace (Bearer atc:read)
 * - GET /v1/workspaces/{id}/chat/roster - Members with emails (cookie or PAT, no scope)
 * - DELETE /v1/workspaces/{id}/members/{userId} - Remove a member (needs workspace:admin or a cookie session)
 */

import type { APIResponse } from '@playwright/test';
import type {
  ErrorEnvelope,
  GetWorkspaceResponse,
  ListMembersResponse,
  ListProjectsResponse,
  ListWorkspacesResponse,
  WorkspaceMemberRemoveResponse,
} from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from WorkspaceApi
export type { GetWorkspaceResponse, ListWorkspacesResponse, WorkspaceMemberRemoveResponse } from '@schemas/workspace.types';

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

  /**
   * Helper: List the members of a workspace (the roster, with emails and roles).
   *
   * @param workspaceId - Workspace UUID
   * @returns Tuple with response and members body
   */
  @step
  async listMembers(workspaceId: string): Promise<[APIResponse, ListMembersResponse]> {
    const [response, body] = await this.apiGET<ListMembersResponse>(`/v1/workspaces/${workspaceId}/chat/roster`);
    return [response, body];
  }

  /**
   * Helper: List the projects of a workspace (up to 20, most recent first).
   *
   * @param workspaceId - Workspace UUID
   * @returns Tuple with response and projects body
   */
  @step
  async listProjects(workspaceId: string): Promise<[APIResponse, ListProjectsResponse]> {
    const [response, body] = await this.apiGET<ListProjectsResponse>(`/v1/workspaces/${workspaceId}/recent-projects`, {
      params: { limit: '20' },
    });
    return [response, body];
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: The caller removes a member (DELETE /v1/workspaces/{id}/members/{userId}).
   *
   * Fixed assertions:
   * - status 200
   * - body: removed_user_id equals the target; removed_role defined; the three
   *   counts (revoked_token_count, unassigned_bug_count, revoked_invite_count) are numbers
   * - the roster no longer lists the target
   *
   * Caller identity comes from the context: a cookie session, or a
   * `workspace:admin` PAT bound to the workspace (setAuthToken).
   *
   * @param args - Workspace and the member to remove
   * @returns Tuple with response and removal body
   */
  @atc('BK-1657')
  async removeMemberSuccessfully(
    args: { workspaceId: string, memberUserId: string },
  ): Promise<[APIResponse, WorkspaceMemberRemoveResponse]> {
    const { workspaceId, memberUserId } = args;
    const [response, body] = await this.apiDELETE<WorkspaceMemberRemoveResponse>(
      `/v1/workspaces/${workspaceId}/members/${memberUserId}`,
    );

    expect(response.status()).toBe(200);
    expect(body.removed_user_id).toBe(memberUserId);
    expect(body.removed_role).toBeDefined();
    expect(typeof body.revoked_token_count).toBe('number');
    expect(typeof body.unassigned_bug_count).toBe('number');
    expect(typeof body.revoked_invite_count).toBe('number');

    const [rosterResponse, roster] = await this.listMembers(workspaceId);
    expect(rosterResponse.status()).toBe(200);
    expect(roster.members.map(member => member.user_id)).not.toContain(memberUserId);

    return [response, body];
  }

  /**
   * ATC: An Admin tries to remove the Owner and is refused.
   *
   * Fixed assertions:
   * - status 403
   * - error.details.reason === 'cannot_remove_owner' (never 'missing_capability')
   * - the roster still lists the Owner with role 'owner'
   *
   * @param args - Workspace and the Owner's user id
   * @returns Tuple with response and error envelope
   */
  @atc('BK-1664')
  async removeOwnerAsAdminRefused(
    args: { workspaceId: string, ownerUserId: string },
  ): Promise<[APIResponse, ErrorEnvelope]> {
    const { workspaceId, ownerUserId } = args;
    const [response, body] = await this.apiDELETE<ErrorEnvelope>(
      `/v1/workspaces/${workspaceId}/members/${ownerUserId}`,
    );

    expect(response.status()).toBe(403);
    expect(this.readReason(body)).toBe('cannot_remove_owner');

    const [rosterResponse, roster] = await this.listMembers(workspaceId);
    expect(rosterResponse.status()).toBe(200);
    expect(roster.members.find(member => member.user_id === ownerUserId)?.role).toBe('owner');

    return [response, body];
  }

  /**
   * ATC: A caller below Admin (Member or Viewer) tries to remove someone and is refused.
   *
   * Fixed assertions:
   * - status 403
   * - error.details.reason === 'not_a_member' (not 'missing_capability', not 409 cannot_remove_self)
   * - the roster is unchanged (same user ids and roles)
   *
   * @param args - Workspace and the target user id (the caller's own id for self rows)
   * @returns Tuple with response and error envelope
   */
  @atc('BK-1665')
  async removeMemberRefusedBelowAdmin(
    args: { workspaceId: string, targetUserId: string },
  ): Promise<[APIResponse, ErrorEnvelope]> {
    const { workspaceId, targetUserId } = args;
    const [beforeResponse, before] = await this.listMembers(workspaceId);
    expect(beforeResponse.status()).toBe(200);

    const [response, body] = await this.apiDELETE<ErrorEnvelope>(
      `/v1/workspaces/${workspaceId}/members/${targetUserId}`,
    );

    expect(response.status()).toBe(403);
    expect(this.readReason(body)).toBe('not_a_member');

    const [rosterResponse, after] = await this.listMembers(workspaceId);
    expect(rosterResponse.status()).toBe(200);
    const byUserId = (a: { user_id: string }, b: { user_id: string }) => a.user_id.localeCompare(b.user_id);
    expect([...after.members].sort(byUserId)).toEqual([...before.members].sort(byUserId));

    return [response, body];
  }

  // ============================================
  // Private Helpers
  // ============================================

  /** Pull `error.details.reason` out of a refusal envelope (details is untyped). */
  private readReason(body: ErrorEnvelope): unknown {
    const details = body.error.details;
    return typeof details === 'object' && details !== null ? (details as { reason?: unknown }).reason : undefined;
  }
}
