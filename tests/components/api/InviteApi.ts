/**
 * KATA Architecture - Layer 3: Invite API Component
 *
 * API component for workspace invitations. Both operations are setup
 * mutations (re-admitting a removed member), so they are `@step` helpers and
 * not ATCs: no signed Test owns them yet.
 *
 * Endpoints (relative to config.apiUrl):
 * - GET /v1/workspaces/{id}/invites - Owner/Admin lists the invites
 * - DELETE /v1/workspaces/{id}/invites/{inviteId} - Owner/Admin revokes an invite
 * - POST /v1/workspaces/{id}/invites - Owner/Admin issues an invite (token shown once)
 * - POST /v1/invites/accept - The invitee accepts with the token
 */

import type { APIResponse } from '@playwright/test';
import type { AcceptInviteRequest, AcceptInviteResponse, CreateInviteRequest, CreateInviteResponse, ListInvitesResponse } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

// ============================================
// Invite API Component
// ============================================

export class InviteApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Setup mutations (no @atc, see AGENTS.md exception O2)
  // ============================================

  /**
   * Helper: Issue an invite to an email.
   *
   * @param args - Workspace, invitee email and role
   * @returns Tuple with response, invite (with the one-time token) and sent payload
   */
  @step
  async provisionInvite(
    args: { workspaceId: string, email: string, role: CreateInviteRequest['role'] },
  ): Promise<[APIResponse, CreateInviteResponse, CreateInviteRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<CreateInviteResponse, CreateInviteRequest>(
      `/v1/workspaces/${args.workspaceId}/invites`,
      { email: args.email, role: args.role },
      // accept_url embeds the raw invite token
      { redactKeys: ['token', 'accept_url'] },
    );
    expect(response.status()).toBe(201);
    return [response, body, sentPayload];
  }

  /**
   * Helper: List the invites of a workspace (Owner/Admin only).
   *
   * @param workspaceId - Workspace UUID
   * @returns Tuple with response and invite list body
   */
  @step
  async listInvites(workspaceId: string): Promise<[APIResponse, ListInvitesResponse]> {
    const [response, body] = await this.apiGET<ListInvitesResponse>(`/v1/workspaces/${workspaceId}/invites`);
    expect(response.status()).toBe(200);
    return [response, body];
  }

  /**
   * Helper: Revoke an invite (a 404 means it is already gone).
   *
   * @param args - Workspace and invite ids
   * @returns Tuple with response and body
   */
  @step
  async revokeInvite(args: { workspaceId: string, inviteId: string }): Promise<[APIResponse, Record<string, unknown>]> {
    const [response, body] = await this.apiDELETE(`/v1/workspaces/${args.workspaceId}/invites/${args.inviteId}`);
    expect([200, 204, 404]).toContain(response.status());
    return [response, body];
  }

  /**
   * Helper: Accept an invite as the invitee.
   *
   * @param args - The one-time invite token (object arg so @step masks it in the title)
   * @returns Tuple with response, acceptance body and sent payload
   */
  @step
  async provisionAcceptance(args: { token: string }): Promise<[APIResponse, AcceptInviteResponse, AcceptInviteRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<AcceptInviteResponse, AcceptInviteRequest>(
      '/v1/invites/accept',
      { token: args.token },
      { redactKeys: ['token'] },
    );
    expect(response.status()).toBe(200);
    return [response, body, sentPayload];
  }
}
