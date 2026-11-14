/**
 * KATA Architecture - Layer 3: Bug API Component
 *
 * API component for Bugs. Used by member-removal tests to hold Bugs on a
 * member (assign) and to read them back after the removal. Writes are setup
 * mutations: `@step` helpers, not ATCs.
 *
 * Endpoints (relative to config.apiUrl):
 * - GET /v1/projects/{id}/bugs - Bugs of a project
 * - GET /v1/projects/{id}/modules - Modules (needed to file a Bug)
 * - GET /v1/bugs/{id} - One Bug
 * - POST /v1/bugs - File a Bug (Idempotency-Key required)
 * - POST /v1/bugs/{id}/assign - Assign or unassign a Bug
 */

import type { APIResponse } from '@playwright/test';
import type { BugAssignBody, BugDetail, CreateBugRequest, CreateBugResponse, ListModulesResponse, ListProjectBugsResponse } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { randomUUID } from 'node:crypto';
import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { step } from '@utils/decorators';

// ============================================
// Bug API Component
// ============================================

export class BugApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Read operations (no @atc)
  // ============================================

  /**
   * Helper: List the Bugs of a project.
   *
   * @param projectId - Project UUID
   * @returns Tuple with response and bug list body
   */
  @step
  async listBugs(projectId: string): Promise<[APIResponse, ListProjectBugsResponse]> {
    const [response, body] = await this.apiGET<ListProjectBugsResponse>(`/v1/projects/${projectId}/bugs`);
    return [response, body];
  }

  /**
   * Helper: List the modules of a project.
   *
   * @param projectId - Project UUID
   * @returns Tuple with response and modules body
   */
  @step
  async listModules(projectId: string): Promise<[APIResponse, ListModulesResponse]> {
    const [response, body] = await this.apiGET<ListModulesResponse>(`/v1/projects/${projectId}/modules`);
    return [response, body];
  }

  /**
   * Helper: Read one Bug by id.
   *
   * @param id - Bug UUID
   * @returns Tuple with response and bug body
   */
  @step
  async getBug(id: string): Promise<[APIResponse, { bug: BugDetail }]> {
    const [response, body] = await this.apiGET<{ bug: BugDetail }>(`/v1/bugs/${id}`);
    return [response, body];
  }

  // ============================================
  // Helpers - Setup mutations (no @atc, see AGENTS.md exception O2)
  // ============================================

  /**
   * Helper: File a standalone Bug in a module.
   *
   * @param args - Project, module, and title
   * @returns Tuple with response, created bug and sent payload
   */
  @step
  async provisionBug(
    args: { projectId: string, moduleId: string, title: string },
  ): Promise<[APIResponse, CreateBugResponse, CreateBugRequest]> {
    const payload: CreateBugRequest = {
      project_id: args.projectId,
      module_id: args.moduleId,
      title: args.title,
      severity: 'P4',
    };
    const [response, body, sentPayload] = await this.apiPOST<CreateBugResponse, CreateBugRequest>(
      '/v1/bugs',
      payload,
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(201);
    return [response, body, sentPayload];
  }

  /**
   * Helper: Assign a Bug to a member, or unassign it with a null assignee.
   *
   * @param args - Bug id and assignee user id (null unassigns)
   * @returns Tuple with response, updated bug and sent payload
   */
  @step
  async provisionAssignment(
    args: { bugId: string, assigneeUserId: string | null },
  ): Promise<[APIResponse, { bug: BugDetail }, BugAssignBody]> {
    const [response, body, sentPayload] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody>(
      `/v1/bugs/${args.bugId}/assign`,
      { assignee_user_id: args.assigneeUserId },
    );
    expect(response.status()).toBe(200);
    return [response, body, sentPayload];
  }
}
