import type { ApiFixture } from '@ApiFixture';
import type { TestLifecycleArena } from '@data/types';

import type { PlaywrightWorkerArgs } from '@playwright/test';
import { TEST_LIFECYCLE_FIXTURE } from '@data/constants';
import { expect } from '@playwright/test';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { TestContext } from '@TestContext';

export interface TestLifecycleSession {
  api: ApiFixture
  arena: TestLifecycleArena
  workspaceCreated: boolean
}

export class TestLifecycleSteps extends TestContext {
  private readonly fixtures: RunFixtureSteps;

  constructor(args: { playwright: PlaywrightWorkerArgs['playwright'] }) {
    super();
    this.fixtures = new RunFixtureSteps({ playwright: args.playwright });
  }

  private async ensureWorkspace(api: ApiFixture): Promise<{ id: string, created: boolean }> {
    const [meResponse, me] = await api.auth.getCurrentUser();
    expect(meResponse.status(), 'arena discovery: GET /me as member').toBe(200);
    const found = me.workspaces.find(workspace => workspace.name === TEST_LIFECYCLE_FIXTURE.workspaceName
      && workspace.owner_user_id === me.user.id);
    if (found) {
      return { id: found.id, created: false };
    }
    const [, body] = await api.workspace.createWorkspace({
      name: TEST_LIFECYCLE_FIXTURE.workspaceName,
      slug: TEST_LIFECYCLE_FIXTURE.workspaceSlug,
    });
    return { id: body.workspace.id, created: true };
  }

  private async ensureProject(args: { api: ApiFixture, workspaceId: string }): Promise<void> {
    const slug = TEST_LIFECYCLE_FIXTURE.projectNamePrefix;
    const [response, found] = await args.api.workspace.findProjectBySlug({ workspaceId: args.workspaceId, slug });
    expect(response.status(), `arena discovery: project lookup by slug ${slug} as member`).toBe(200);
    if (found.projects.length === 0) {
      await args.api.workspace.createProject({ workspaceId: args.workspaceId, name: slug });
    }
  }

  async openMemberArena(): Promise<TestLifecycleSession> {
    const owner = await this.fixtures.openOwnerSession();
    const member = await this.fixtures.openMemberSession(owner);
    const workspace = await this.ensureWorkspace(member.api);
    await this.ensureProject({ api: member.api, workspaceId: workspace.id });
    const project = await this.fixtures.discoverProject({
      api: member.api,
      role: 'member',
      workspaceId: workspace.id,
      slug: TEST_LIFECYCLE_FIXTURE.projectNamePrefix,
    });
    return { api: member.api, arena: { workspaceId: workspace.id, project }, workspaceCreated: workspace.created };
  }

  async release(): Promise<void> {
    await this.fixtures.teardown();
  }
}
