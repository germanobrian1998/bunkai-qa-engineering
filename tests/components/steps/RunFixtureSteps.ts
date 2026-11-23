import type { FixtureProject, RunExecutor, RunOutcome, RunRecipe } from '@data/types';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { MeResponse } from '@schemas/auth.types';
import type { CreateTokenBody } from '@schemas/workspace.types';

import { ApiFixture } from '@ApiFixture';
import { expect } from '@playwright/test';
import { TestContext } from '@TestContext';
import { config } from '@variables';

export interface OwnerSession {
  workspaceId: string
  owner: ApiFixture
  reader?: ApiFixture
}

export type ReaderSession = OwnerSession & { reader: ApiFixture };

export interface MemberSession {
  api: ApiFixture
  ownWorkspaceId: string
}

const FIXTURE_TOKEN_NAME = 'kata-bk225-fixture';
const EXECUTORS: RunExecutor[] = ['human', 'agent', 'ci'];
const OUTCOMES: RunOutcome[] = ['passed', 'failed', 'aborted', 'running'];

export class RunFixtureSteps extends TestContext {
  private readonly playwright: PlaywrightWorkerArgs['playwright'];
  private readonly contexts: APIRequestContext[] = [];
  private readonly mintedTokens: { api: ApiFixture, id: string }[] = [];

  constructor(args: { playwright: PlaywrightWorkerArgs['playwright'] }) {
    super();
    this.playwright = args.playwright;
  }

  private async openContext(storageState?: string): Promise<APIRequestContext> {
    const request = await this.playwright.request.newContext(storageState ? { storageState } : {});
    this.contexts.push(request);
    return request;
  }

  private pickOwnedWorkspace(me: MeResponse, role: string): string {
    const owned = me.workspaces.filter(workspace => workspace.owner_user_id === me.user.id);
    const active = owned.find(workspace => workspace.id === me.active_workspace_id);
    const picked = active ?? owned[0];
    if (!picked) {
      const candidates = me.workspaces.map(workspace => `${workspace.id} (owner_user_id ${workspace.owner_user_id})`).join(', ');
      throw new Error(`fixture broken: ${role} user ${me.user.id} owns no workspace; candidates: [${candidates}]`);
    }
    return picked.id;
  }

  async openOwnerSession(options: { reader: true }): Promise<ReaderSession>;
  async openOwnerSession(options?: { reader?: boolean }): Promise<OwnerSession>;
  async openOwnerSession(options: { reader?: boolean } = {}): Promise<OwnerSession> {
    const owner = new ApiFixture({ request: await this.openContext(config.auth.roleStatePath('owner')) });
    const [meResponse, me] = await owner.auth.getCurrentUser();
    expect(meResponse.status(), 'fixture discovery: GET /me as owner').toBe(200);
    const workspaceId = this.pickOwnedWorkspace(me, 'owner');
    if (!options.reader) {
      return { workspaceId, owner };
    }
    const reader = await this.mintBearer({ owner, workspaceId, scopes: ['atc:read'] });
    return { workspaceId, owner, reader };
  }

  async mintBearer(args: { owner: ApiFixture, workspaceId: string, scopes: CreateTokenBody['scopes'] }): Promise<ApiFixture> {
    const [, token] = await args.owner.auth.provisionToken({
      scopes: args.scopes,
      workspaceId: args.workspaceId,
      expiresInDays: 1,
      name: FIXTURE_TOKEN_NAME,
    });
    this.mintedTokens.push({ api: args.owner, id: token.id });
    const bearer = new ApiFixture({ request: await this.openContext() });
    bearer.setAuthToken(token.token);
    return bearer;
  }

  async openMemberSession(session: OwnerSession): Promise<MemberSession> {
    const api = new ApiFixture({ request: await this.openContext(config.auth.roleStatePath('member')) });
    const [meResponse, me] = await api.auth.getCurrentUser();
    expect(meResponse.status(), 'fixture discovery: GET /me as member').toBe(200);
    const ownWorkspaceId = this.pickOwnedWorkspace(me, 'member');
    expect(ownWorkspaceId, 'the Member workspace must differ from the Owner workspace').not.toBe(session.workspaceId);
    return { api, ownWorkspaceId };
  }

  async discoverProject(args: { api: ApiFixture, role: string, workspaceId: string, slug: string }): Promise<FixtureProject> {
    const [response, found] = await args.api.workspace.findProjectBySlug({ workspaceId: args.workspaceId, slug: args.slug });
    expect(response.status(), `fixture discovery: project lookup by slug ${args.slug} as ${args.role}`).toBe(200);
    const project = found.projects[0];
    if (!project) {
      throw new Error(`fixture broken: project ${args.slug} not found in workspace ${args.workspaceId}`);
    }
    return { id: project.id, slug: args.slug, workspaceId: args.workspaceId };
  }

  private async readComposition(args: { api: ApiFixture, role: string, project: FixtureProject }): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    let cursor: string | null = null;
    do {
      const [response, page] = await args.api.runs.getReport({
        projectId: args.project.id,
        query: cursor ? { cursor: [cursor] } : {},
      });
      expect(response.status(), `fixture composition: GET runs/report of ${args.project.slug} as ${args.role}`).toBe(200);
      for (const item of page.items) {
        const key = `${item.executor_mode}:${item.status}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      cursor = page.next_cursor;
    } while (cursor);
    return counts;
  }

  async readAllRunIds(args: { api: ApiFixture, role: string, project: FixtureProject }): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const [response, page] = await args.api.runs.getReport({
        projectId: args.project.id,
        query: cursor ? { cursor: [cursor] } : {},
      });
      expect(response.status(), `all run ids: GET runs/report of ${args.project.slug} as ${args.role}`).toBe(200);
      ids.push(...page.items.map(item => item.id));
      cursor = page.next_cursor;
    } while (cursor);
    return ids;
  }

  private expectedComposition(recipe: RunRecipe): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const executor of EXECUTORS) {
      for (const outcome of OUTCOMES) {
        const count = recipe[executor]?.[outcome] ?? 0;
        if (count > 0) {
          counts[`${executor}:${outcome}`] = count;
        }
      }
    }
    return counts;
  }

  async assertComposition(args: { api: ApiFixture, role: string, project: FixtureProject, recipe: RunRecipe }): Promise<void> {
    const found = await this.readComposition(args);
    const expected = this.expectedComposition(args.recipe);
    if (JSON.stringify(Object.entries(found).sort()) !== JSON.stringify(Object.entries(expected).sort())) {
      throw new Error(`fixture drift or report endpoint regression: ${args.project.slug} holds ${JSON.stringify(found)}, expected ${JSON.stringify(expected)}`);
    }
  }

  async teardown(): Promise<void> {
    const errors: unknown[] = [];
    const failedTokenIds: string[] = [];
    for (const token of this.mintedTokens) {
      try {
        await token.api.auth.revokeToken(token.id);
      }
      catch (error) {
        failedTokenIds.push(token.id);
        errors.push(error);
      }
    }
    for (const context of this.contexts) {
      try {
        await context.dispose();
      }
      catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, `teardown failed: could not revoke token ids [${failedTokenIds.join(', ')}]; ${errors.length} error(s) in total`);
    }
  }
}
