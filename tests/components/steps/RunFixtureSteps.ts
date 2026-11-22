import type { FixtureProject, RunExecutor, RunOutcome, RunRecipe } from '@data/types';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { CreateTokenBody } from '@schemas/workspace.types';

import { ApiFixture } from '@ApiFixture';
import { expect } from '@playwright/test';
import { TestContext } from '@TestContext';
import { config } from '@variables';

export interface OwnerSession {
  workspaceId: string
  owner: ApiFixture
  reader: ApiFixture
}

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

  async openOwnerSession(): Promise<OwnerSession> {
    const owner = new ApiFixture({ request: await this.openContext(config.auth.roleStatePath('owner')) });
    const [meResponse, me] = await owner.auth.getCurrentUser();
    expect(meResponse.status()).toBe(200);
    const workspaceId = me.active_workspace_id ?? me.workspaces[0]?.id;
    expect(workspaceId, 'the Owner needs an active workspace').toBeDefined();
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
    const [, me] = await api.auth.getCurrentUser();
    const own = me.workspaces.find(workspace => workspace.id !== session.workspaceId);
    if (!own) {
      throw new Error('fixture broken: the Member has no workspace of their own besides the Owner workspace');
    }
    return { api, ownWorkspaceId: own.id };
  }

  async discoverProject(args: { api: ApiFixture, workspaceId: string, slug: string }): Promise<FixtureProject> {
    const [, found] = await args.api.workspace.findProjectBySlug({ workspaceId: args.workspaceId, slug: args.slug });
    const project = found.projects[0];
    if (!project) {
      throw new Error(`fixture broken: project ${args.slug} not found in workspace ${args.workspaceId}`);
    }
    return { id: project.id, slug: args.slug, workspaceId: args.workspaceId };
  }

  private async readComposition(args: { api: ApiFixture, project: FixtureProject }): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    let cursor: string | null = null;
    do {
      const [, page] = await args.api.runs.getReport({
        projectId: args.project.id,
        query: cursor ? { cursor: [cursor] } : {},
      });
      for (const item of page.items) {
        const key = `${item.executor_mode}:${item.status}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      cursor = page.next_cursor;
    } while (cursor);
    return counts;
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

  async assertComposition(args: { api: ApiFixture, project: FixtureProject, recipe: RunRecipe }): Promise<void> {
    const found = await this.readComposition(args);
    const expected = this.expectedComposition(args.recipe);
    if (JSON.stringify(Object.entries(found).sort()) !== JSON.stringify(Object.entries(expected).sort())) {
      throw new Error(`fixture broken: project ${args.project.slug} holds ${JSON.stringify(found)}, expected ${JSON.stringify(expected)}`);
    }
  }

  async teardown(): Promise<void> {
    const errors: unknown[] = [];
    for (const token of this.mintedTokens) {
      try {
        await token.api.auth.revokeToken(token.id);
      }
      catch (error) {
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
      throw errors[0];
    }
  }
}
