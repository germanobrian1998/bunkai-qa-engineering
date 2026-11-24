import type { FixtureProject, TestLifecycleArena } from '@data/types';

import type { APIRequestContext, Browser, BrowserContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { WorkspaceRole } from '@variables';
import { ApiFixture } from '@ApiFixture';
import { ACTIVE_WORKSPACE_COOKIE, TEST_LIFECYCLE_FIXTURE, TEST_LIFECYCLE_FOREIGN_FIXTURE } from '@data/constants';
import { DataFactory } from '@DataFactory';
import { expect } from '@playwright/test';
import { TestContext } from '@TestContext';
import { TestDetailPage } from '@ui/TestDetailPage';
import { config } from '@variables';

export interface TestLifecycleSession {
  api: ApiFixture
  arena: TestLifecycleArena
}

type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

const INVITED_ROLES = ['member', 'viewer', 'admin'] as const;

export class TestLifecycleSteps extends TestContext {
  private readonly playwright: PlaywrightWorkerArgs['playwright'];
  private readonly contexts: APIRequestContext[] = [];
  private readonly browserContexts: BrowserContext[] = [];
  private readonly sessions = new Map<string, ApiFixture>();

  constructor(args: { playwright: PlaywrightWorkerArgs['playwright'] }) {
    super();
    this.playwright = args.playwright;
  }

  private async openRole(role: WorkspaceRole, workspaceId?: string): Promise<ApiFixture> {
    const key = `${role}:${workspaceId ?? ''}`;
    const cached = this.sessions.get(key);
    if (cached) {
      return cached;
    }
    const request = await this.playwright.request.newContext({
      storageState: workspaceId ? await this.stateScopedTo({ role, workspaceId }) : config.auth.roleStatePath(role),
    });
    this.contexts.push(request);
    const session = new ApiFixture({ request });
    this.sessions.set(key, session);
    return session;
  }

  private async stateScopedTo(args: { role: WorkspaceRole, workspaceId: string }): Promise<StorageState> {
    const probe = await this.playwright.request.newContext({ storageState: config.auth.roleStatePath(args.role) });
    try {
      const state = await probe.storageState();
      const cookies = state.cookies.filter(cookie => cookie.name !== ACTIVE_WORKSPACE_COOKIE);
      cookies.push({
        name: ACTIVE_WORKSPACE_COOKIE,
        value: args.workspaceId,
        domain: new URL(config.baseUrl).hostname,
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      });
      return { cookies, origins: state.origins };
    }
    finally {
      await probe.dispose();
    }
  }

  private async ensureWorkspace(owner: ApiFixture): Promise<string> {
    const [meResponse, me] = await owner.auth.getCurrentUser();
    expect(meResponse.status(), 'arena discovery: GET /me as owner').toBe(200);
    const found = me.workspaces.find(workspace => workspace.name === TEST_LIFECYCLE_FIXTURE.workspaceName
      && workspace.owner_user_id === me.user.id);
    if (found) {
      return found.id;
    }
    const [, body] = await owner.workspace.createWorkspace({
      name: TEST_LIFECYCLE_FIXTURE.workspaceName,
      slug: TEST_LIFECYCLE_FIXTURE.workspaceSlug,
    });
    return body.workspace.id;
  }

  private async ensureMemberships(args: { owner: ApiFixture, workspaceId: string }): Promise<void> {
    const { owner, workspaceId } = args;
    const [rosterResponse, roster] = await owner.workspace.listMembers(workspaceId);
    expect(rosterResponse.status(), `arena discovery: member roster of workspace ${workspaceId}`).toBe(200);
    for (const role of INVITED_ROLES) {
      const email = config.roleUser(role).email.toLowerCase();
      const entry = roster.members.find(member => member.email.toLowerCase() === email);
      if (entry) {
        if (entry.role !== role) {
          throw new Error(`fixture broken: workspace ${workspaceId}: ${role} user holds the role ${entry.role}`);
        }
        continue;
      }
      const [, invites] = await owner.invite.listInvites(workspaceId);
      for (const pending of invites.invites) {
        if (pending.email.toLowerCase() === email && pending.status === 'pending') {
          await owner.invite.revokeInvite({ workspaceId, inviteId: pending.id });
        }
      }
      const [, invite] = await owner.invite.provisionInvite({ workspaceId, email, role });
      const invitee = await this.openRole(role);
      await invitee.invite.provisionAcceptance({ token: invite.token });
    }
  }

  private async findProject(args: { api: ApiFixture, workspaceId: string }): Promise<FixtureProject | null> {
    const slug = TEST_LIFECYCLE_FIXTURE.projectName;
    const [response, found] = await args.api.workspace.findProjectBySlug({ workspaceId: args.workspaceId, slug });
    expect(response.status(), `arena discovery: project lookup by slug ${slug}`).toBe(200);
    const project = found.projects[0];
    return project ? { id: project.id, slug, workspaceId: args.workspaceId } : null;
  }

  private async ensureProject(args: { owner: ApiFixture, workspaceId: string }): Promise<FixtureProject> {
    const existing = await this.findProject({ api: args.owner, workspaceId: args.workspaceId });
    if (existing) {
      return existing;
    }
    await args.owner.workspace.createProject({ workspaceId: args.workspaceId, name: TEST_LIFECYCLE_FIXTURE.projectName });
    const created = await this.findProject({ api: args.owner, workspaceId: args.workspaceId });
    if (!created) {
      throw new Error(`fixture broken: project ${TEST_LIFECYCLE_FIXTURE.projectName} not found after creation in workspace ${args.workspaceId}`);
    }
    return created;
  }

  private async createCriterion(args: { owner: ApiFixture, userStoryId: string }): Promise<string> {
    const [, body] = await args.owner.structure.createAcceptanceCriterion({
      userStoryId: args.userStoryId,
      title: TEST_LIFECYCLE_FIXTURE.criterionTitle,
    });
    return body.acceptance_criterion.id;
  }

  private async ensureScaffoldAtc(args: { owner: ApiFixture, project: FixtureProject }): Promise<string> {
    const { owner, project } = args;
    const [treeResponse, tree] = await owner.bug.listModules(project.id);
    expect(treeResponse.status(), 'arena discovery: module tree').toBe(200);

    const foundModule = tree.modules.find(item => item.name === TEST_LIFECYCLE_FIXTURE.moduleName);
    const moduleId = foundModule
      ? foundModule.id
      : (await owner.structure.createModule({ projectId: project.id, name: TEST_LIFECYCLE_FIXTURE.moduleName }))[1].module.id;

    const foundStory = tree.user_stories.find(item => item.module_id === moduleId && item.title === TEST_LIFECYCLE_FIXTURE.storyTitle);
    const storyId = foundStory
      ? foundStory.id
      : (await owner.structure.createUserStory({ moduleId, title: TEST_LIFECYCLE_FIXTURE.storyTitle }))[1].user_story.id;

    const foundCriterion = tree.acceptance_criteria.find(item => item.user_story_id === storyId
      && item.title === TEST_LIFECYCLE_FIXTURE.criterionTitle);
    const criterionId = foundCriterion ? foundCriterion.id : await this.createCriterion({ owner, userStoryId: storyId });

    const title = TEST_LIFECYCLE_FIXTURE.atcTitle;
    const [searchResponse, found] = await owner.atcs.searchAtcs({ projectId: project.id, query: title });
    expect(searchResponse.status(), 'arena discovery: ATC search').toBe(200);
    const existing = found.items.find(item => item.title === title);
    if (existing) {
      return existing.id;
    }
    const [, atcBody] = await owner.atcs.createAtc(DataFactory.createAtcPayload({
      title,
      moduleId,
      userStoryId: storyId,
      acceptanceCriterionIds: [criterionId],
    }));
    return atcBody.atc.id;
  }

  async openMemberArena(): Promise<TestLifecycleSession> {
    const owner = await this.openRole('owner');
    const workspaceId = await this.ensureWorkspace(owner);
    await this.ensureMemberships({ owner, workspaceId });
    const project = await this.ensureProject({ owner, workspaceId });
    const atcId = await this.ensureScaffoldAtc({ owner, project });
    const member = await this.openRole('member');
    return { api: member, arena: { workspaceId, project, atcId } };
  }

  async openRoleSession(args: { role: WorkspaceRole, workspaceId?: string }): Promise<ApiFixture> {
    return this.openRole(args.role, args.workspaceId);
  }

  async openRoleTestDetail(args: { browser: Browser, role: WorkspaceRole }): Promise<TestDetailPage> {
    const context = await args.browser.newContext({ storageState: config.auth.roleStatePath(args.role) });
    this.browserContexts.push(context);
    return new TestDetailPage({ page: await context.newPage() });
  }

  private async findForeignWorkspaceId(member: ApiFixture): Promise<string> {
    const [meResponse, me] = await member.auth.getCurrentUser();
    expect(meResponse.status(), 'foreign arena discovery: GET /me as member').toBe(200);
    const found = me.workspaces.find(workspace => workspace.name === TEST_LIFECYCLE_FOREIGN_FIXTURE.workspaceName
      && workspace.owner_user_id === me.user.id);
    if (!found) {
      throw new Error(`fixture broken: member-owned workspace "${TEST_LIFECYCLE_FOREIGN_FIXTURE.workspaceName}" not found`);
    }
    return found.id;
  }

  private async expectNotMember(args: { api: ApiFixture, workspaceId: string }): Promise<void> {
    const [meResponse, me] = await args.api.auth.getCurrentUser();
    expect(meResponse.status(), 'foreign arena discovery: GET /me as non-member').toBe(200);
    if (me.workspaces.some(workspace => workspace.id === args.workspaceId)) {
      throw new Error(`fixture broken: the non-member user belongs to workspace ${args.workspaceId}`);
    }
  }

  async openForeignArena(): Promise<TestLifecycleSession> {
    const plainMember = await this.openRole('member');
    const viewer = await this.openRole('viewer');
    const workspaceId = await this.findForeignWorkspaceId(plainMember);
    await this.expectNotMember({ api: viewer, workspaceId });
    const member = await this.openRole('member', workspaceId);
    const project = await this.findProject({ api: member, workspaceId });
    if (!project) {
      throw new Error(`fixture broken: project ${TEST_LIFECYCLE_FIXTURE.projectName} not found in workspace ${workspaceId}`);
    }
    const atcId = await this.ensureScaffoldAtc({ owner: member, project });
    return { api: member, arena: { workspaceId, project, atcId } };
  }

  async release(): Promise<void> {
    const errors: unknown[] = [];
    for (const context of this.browserContexts) {
      try {
        await context.close();
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
      throw new AggregateError(errors, `release failed: ${errors.length} context(s) could not be disposed`);
    }
  }
}
