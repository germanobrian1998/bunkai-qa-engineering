/**
 * KATA Architecture - Layer 3.5: Member Removal Steps
 *
 * Reusable preconditions and teardown for the BK-572 member-removal tests
 * (TC6, TC7, TC14, TC15, TC28). Not a fixture: instantiate it in the test.
 *
 * Contract (consumable fixture, destructive specs):
 * - discoverFixture() opens the four role sessions and checks the roster with
 *   ONE oracle (rosterProblems: the four role emails present with their
 *   expected role; the member count is not part of it). When only the Member
 *   is missing it re-admits them; any other defect FAILS with
 *   "fixture broken: <what>". It never skips.
 * - readmitMember() puts a removed Member back (Owner invite + Member accept,
 *   revoking a pending invite first) and is called from teardown, which checks
 *   the same oracle.
 * - teardown() runs every cleanup step independently, disposes last, and
 *   rethrows the first teardown error only when the test itself passed.
 *
 * Role sessions use the cookie storageState written by the
 * `role-sessions-setup` project. A fresh ApiFixture carries no Bearer, which
 * matters because a Bearer always wins over the cookie and `api:login` PATs
 * never carry workspace:admin.
 */

import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { ActivityItem, ChatMember, CreateTokenResponse } from '@schemas/workspace.types';
import type { WorkspaceRole } from '@variables';

import { ApiFixture } from '@ApiFixture';
import { expect } from '@playwright/test';
import { TestContext } from '@TestContext';
import { config, workspaceRoles } from '@variables';

// ============================================
// Types
// ============================================

/** An API caller with a role's cookie session. */
export interface RoleSession {
  role: WorkspaceRole
  email: string
  api: ApiFixture
  close: () => Promise<void>
}

/** The discovered workspace, its four callers and their ids. */
export interface RemovalFixture {
  workspaceId: string
  /** A workspace of the Member other than the fixture one; null when none. */
  secondWorkspaceId: string | null
  sessions: Record<WorkspaceRole, RoleSession>
  /** Role user ids by role (all four are on the roster once discoverFixture returns). */
  userIds: Record<WorkspaceRole, string>
  close: () => Promise<void>
}

/** What TC7 needs the Member to hold before the removal. */
export interface RemovableMember {
  scopedPat: CreateTokenResponse
  globalPat: CreateTokenResponse
  heldBugIds: string[]
  authoredBugId: string
}

/**
 * Everything TC7 minted or changed, recorded the moment it exists so the
 * teardown can undo it even when the test dies half way.
 */
export interface RemovalLedger {
  scopedPat?: CreateTokenResponse
  globalPat?: CreateTokenResponse
  ownerPat?: CreateTokenResponse
  heldBugIds: string[]
  authoredBugId?: string
  /** True once the removal ATC returned (the DELETE ran and passed). */
  removalRan: boolean
}

/** Roster and activity ids read before an action, to prove "nothing changed". */
export interface MembersSnapshot {
  roster: ChatMember[]
  activityIds: string[]
}

// ============================================
// Member Removal Steps
// ============================================

/** Name every PAT minted by the BK-572 tests carries; the pre-clean revokes only these. */
const FIXTURE_TOKEN_NAME = 'kata-bk572-fixture';

export class MemberRemovalSteps extends TestContext {
  private readonly playwright: PlaywrightWorkerArgs['playwright'];

  constructor(args: { playwright: PlaywrightWorkerArgs['playwright'] }) {
    super();
    this.playwright = args.playwright;
  }

  // ============================================
  // Sessions
  // ============================================

  /** Open an API caller from a role's cookie storageState (no Bearer). */
  async openRoleSession(role: WorkspaceRole): Promise<RoleSession> {
    const request = await this.playwright.request.newContext({ storageState: config.auth.roleStatePath(role) });
    const api = new ApiFixture({ request });
    return { role, email: config.roleUser(role).email, api, close: async () => request.dispose() };
  }

  /** Open an API caller that holds only a Bearer PAT (no cookie). */
  async openBearerSession(token: string): Promise<{ api: ApiFixture, close: () => Promise<void> }> {
    const request: APIRequestContext = await this.playwright.request.newContext();
    const api = new ApiFixture({ request });
    api.setAuthToken(token);
    return { api, close: async () => request.dispose() };
  }

  // ============================================
  // Discover
  // ============================================

  /**
   * Discover the fixture workspace: the Owner's workspace whose roster holds the
   * most role emails, the role user ids and the Member's second workspace.
   * Self-heals a missing Member; any other defect throws "fixture broken: ...".
   */
  async discoverFixture(): Promise<RemovalFixture> {
    const entries = await Promise.all(workspaceRoles.map(async role => [role, await this.openRoleSession(role)] as const));
    const sessions = Object.fromEntries(entries) as Record<WorkspaceRole, RoleSession>;
    const close = async () => {
      await Promise.all(workspaceRoles.map(async role => sessions[role].close()));
    };

    try {
      const owner = sessions.owner.api;
      const [, workspaces] = await owner.workspace.listWorkspaces();

      let best: { workspaceId: string, matches: number } | null = null;
      for (const workspace of workspaces.workspaces) {
        const [, roster] = await owner.workspace.listMembers(workspace.id);
        const emails = roster.members.map(member => member.email.toLowerCase());
        const matches = workspaceRoles.filter(role => emails.includes(sessions[role].email.toLowerCase())).length;
        if (matches === workspaceRoles.length || (matches > (best?.matches ?? 1))) {
          best = { workspaceId: workspace.id, matches };
          if (matches === workspaceRoles.length) {
            break;
          }
        }
      }
      if (!best) {
        throw new Error('fixture broken: no workspace of the Owner holds at least two of the four role accounts');
      }

      const fx: RemovalFixture = {
        workspaceId: best.workspaceId,
        secondWorkspaceId: null,
        sessions,
        userIds: { owner: '', admin: '', member: '', viewer: '' },
        close,
      };

      // Self-heal: only the Member missing (owner/admin/viewer present) is re-admitted
      const problems = await this.rosterProblems(fx);
      if (problems.length === 1 && fx.userIds.member === '') {
        await this.readmitMember(fx);
      }
      else {
        this.assertRosterHealthy(problems, fx);
      }

      const [, me] = await sessions.member.api.auth.getCurrentUser();
      fx.secondWorkspaceId = me.workspaces.find(workspace => workspace.id !== fx.workspaceId)?.id ?? null;
      return fx;
    }
    catch (error) {
      await close();
      throw error;
    }
  }

  /**
   * THE roster oracle, used by discovery and teardown alike: each of the four
   * role emails is on the roster with its expected role. The member count is
   * not part of it. Refreshes fx.userIds as a side effect.
   *
   * @returns The defects found; empty when the roster is healthy
   */
  async rosterProblems(fx: RemovalFixture): Promise<string[]> {
    const [rosterResponse, roster] = await fx.sessions.owner.api.workspace.listMembers(fx.workspaceId);
    expect(rosterResponse.status(), 'the Owner must be able to read the roster').toBe(200);
    const problems: string[] = [];
    for (const role of workspaceRoles) {
      const email = fx.sessions[role].email;
      const entry = roster.members.find(member => member.email.toLowerCase() === email.toLowerCase());
      if (!entry) {
        fx.userIds[role] = '';
        problems.push(`${role} (${email}) is not on the roster`);
        continue;
      }
      fx.userIds[role] = entry.user_id;
      if (entry.role !== role) {
        problems.push(`${role} (${email}) holds the role ${entry.role}`);
      }
    }
    return problems;
  }

  /**
   * Per-test guard for destructive specs: re-check the roster oracle (one roster
   * GET, no sign-in), re-admit a lone missing Member, else throw "fixture broken: ...".
   */
  async ensureFixtureHealthy(fx: RemovalFixture): Promise<void> {
    const problems = await this.rosterProblems(fx);
    if (problems.length === 1 && fx.userIds.member === '') {
      await this.readmitMember(fx);
    }
    else {
      this.assertRosterHealthy(problems, fx);
    }
  }

  /** Throw "fixture broken: ..." when the oracle found defects. */
  private assertRosterHealthy(problems: string[], fx: RemovalFixture): void {
    if (problems.length > 0) {
      throw new Error(`fixture broken: workspace ${fx.workspaceId}: ${problems.join('; ')}`);
    }
  }

  /** Roster and activity ids as seen by the Owner, to compare after an attempted removal. */
  async takeSnapshot(fx: RemovalFixture): Promise<MembersSnapshot> {
    const [, roster] = await fx.sessions.owner.api.workspace.listMembers(fx.workspaceId);
    const [, activity] = await fx.sessions.owner.api.activity.listActivity(fx.workspaceId);
    return {
      roster: [...roster.members].sort((a, b) => a.user_id.localeCompare(b.user_id)),
      activityIds: activity.items.map(item => item.id),
    };
  }

  /** Activity items that appeared after the snapshot, optionally filtered by action. */
  async readNewActivity(args: { fx: RemovalFixture, since: MembersSnapshot }): Promise<ActivityItem[]> {
    const [, activity] = await args.fx.sessions.owner.api.activity.listActivity(args.fx.workspaceId);
    return activity.items.filter(item => !args.since.activityIds.includes(item.id));
  }

  // ============================================
  // Generate / Modify (TC7 preconditions)
  // ============================================

  /** A fresh, empty ledger for one TC7 run. */
  newLedger(): RemovalLedger {
    return { heldBugIds: [], removalRan: false };
  }

  /** Every Bug of the fixture workspace, flattened across its projects. */
  private async listWorkspaceBugs(fx: RemovalFixture): Promise<{ id: string, assignee: string | null, status: string, createdBy: string | null }[]> {
    const owner = fx.sessions.owner.api;
    const [, projects] = await owner.workspace.listProjects(fx.workspaceId);
    const bugs: { id: string, assignee: string | null, status: string, createdBy: string | null }[] = [];
    for (const project of projects.projects) {
      const [, list] = await owner.bug.listBugs(project.id);
      bugs.push(...list.items.map(bug => ({
        id: bug.id,
        assignee: bug.assignee_user_id,
        status: bug.status,
        createdBy: bug.created_by,
      })));
    }
    return bugs;
  }

  /**
   * Clean start for TC7: revoke the Member's live PATs minted by these tests
   * (scoped and global) and unassign every Bug assigned to them, so the exact
   * counts asserted afterwards (1 revoked, 3 unassigned) cannot be inflated by
   * the leftovers of an earlier failed run.
   */
  async cleanMemberLeftovers(fx: RemovalFixture): Promise<void> {
    const member = fx.sessions.member.api;
    const [, tokens] = await member.auth.listTokens();
    for (const token of tokens.tokens) {
      if (token.name === FIXTURE_TOKEN_NAME && !token.revoked_at) {
        await member.auth.revokeToken(token.id);
      }
    }
    for (const bug of await this.listWorkspaceBugs(fx)) {
      if (bug.assignee === fx.userIds.member) {
        await fx.sessions.owner.api.bug.provisionAssignment({ bugId: bug.id, assigneeUserId: null });
      }
    }
  }

  /**
   * Make the Member removable with every side effect TC7 asserts: a workspace-scoped
   * PAT, a global PAT, three Bugs assigned to them and an authored Bug.
   * Starts from a clean Member, discovers (unassigned Bugs, a Bug the Member filed),
   * generates only the missing ones, and records each PAT / assignment in the ledger
   * the moment it exists.
   */
  async provisionRemovableMember(fx: RemovalFixture, ledger: RemovalLedger): Promise<RemovableMember> {
    const owner = fx.sessions.owner.api;
    const member = fx.sessions.member.api;
    const memberId = fx.userIds.member;

    await this.cleanMemberLeftovers(fx);

    [, ledger.scopedPat] = await member.auth.provisionToken({ scopes: ['atc:read'], workspaceId: fx.workspaceId, expiresInDays: 1 });
    [, ledger.globalPat] = await member.auth.provisionToken({ scopes: ['atc:read'], expiresInDays: 1 });

    const bugs = await this.listWorkspaceBugs(fx);
    const [, projects] = await owner.workspace.listProjects(fx.workspaceId);
    const projectId = projects.projects[0]?.id;
    expect(projectId, 'the fixture workspace needs a project to hold Bugs').toBeDefined();
    const [, modules] = await owner.bug.listModules(projectId);
    const moduleId = modules.modules[0]?.id;
    expect(moduleId, 'the fixture project needs a module to file Bugs').toBeDefined();

    let authoredBugId = bugs.find(bug => bug.createdBy === memberId)?.id;
    if (!authoredBugId) {
      const [, created] = await member.bug.provisionBug({ projectId, moduleId, title: 'BK-572 member-authored fixture bug' });
      authoredBugId = created.bug.id;
    }
    ledger.authoredBugId = authoredBugId;

    const candidates = bugs
      .filter(bug => bug.assignee === null && ['open', 'in_progress'].includes(bug.status) && bug.id !== authoredBugId)
      .slice(0, 3)
      .map(bug => bug.id);
    while (candidates.length < 3) {
      const [, created] = await owner.bug.provisionBug({ projectId, moduleId, title: `BK-572 held fixture bug ${candidates.length + 1}` });
      candidates.push(created.bug.id);
    }
    for (const bugId of candidates) {
      await owner.bug.provisionAssignment({ bugId, assigneeUserId: memberId });
      ledger.heldBugIds.push(bugId);
    }

    return { scopedPat: ledger.scopedPat, globalPat: ledger.globalPat, heldBugIds: ledger.heldBugIds, authoredBugId };
  }

  // ============================================
  // Teardown
  // ============================================

  /**
   * Put the Member back: Owner invites their email (a pending invite for it is
   * revoked first), Member accepts, then the roster oracle must pass.
   * A no-op when the Member is already on the roster.
   */
  async readmitMember(fx: RemovalFixture): Promise<void> {
    const owner = fx.sessions.owner.api;
    const member = fx.sessions.member;

    const [, before] = await owner.workspace.listMembers(fx.workspaceId);
    if (!before.members.some(entry => entry.email.toLowerCase() === member.email.toLowerCase())) {
      const [, invites] = await owner.invite.listInvites(fx.workspaceId);
      for (const pending of invites.invites) {
        if (pending.email.toLowerCase() === member.email.toLowerCase() && pending.status === 'pending') {
          await owner.invite.revokeInvite({ workspaceId: fx.workspaceId, inviteId: pending.id });
        }
      }
      const [, invite] = await owner.invite.provisionInvite({ workspaceId: fx.workspaceId, email: member.email, role: 'member' });
      await member.api.invite.provisionAcceptance({ token: invite.token });
    }

    this.assertRosterHealthy(await this.rosterProblems(fx), fx);
  }

  /**
   * Undo what a TC7 run left: revoke the PATs it minted (a 404 is fine) and, when
   * the removal never ran, unassign the Bugs it assigned to the Member.
   */
  async releaseLedger(fx: RemovalFixture, ledger: RemovalLedger): Promise<void> {
    const errors: unknown[] = [];
    const attempt = async (action: () => Promise<unknown>) => {
      try {
        await action();
      }
      catch (error) {
        errors.push(error);
      }
    };

    for (const pat of [ledger.scopedPat, ledger.globalPat]) {
      if (pat) {
        await attempt(async () => fx.sessions.member.api.auth.revokeToken(pat.id));
      }
    }
    if (ledger.ownerPat) {
      const ownerPat = ledger.ownerPat;
      await attempt(async () => fx.sessions.owner.api.auth.revokeToken(ownerPat.id));
    }
    if (!ledger.removalRan) {
      for (const bugId of ledger.heldBugIds) {
        await attempt(async () => fx.sessions.owner.api.bug.provisionAssignment({ bugId, assigneeUserId: null }));
      }
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Run every teardown step independently, then dispose, always last. The first
   * teardown error is rethrown only when the test itself passed, so a teardown
   * failure never masks the original failure (it is logged instead).
   */
  async teardown(args: {
    tasks: (() => Promise<void>)[]
    dispose: (() => Promise<void>)[]
    testPassed: boolean
  }): Promise<void> {
    const errors: unknown[] = [];
    for (const task of args.tasks) {
      try {
        await task();
      }
      catch (error) {
        errors.push(error);
      }
    }
    for (const dispose of args.dispose) {
      try {
        await dispose();
      }
      catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 0) {
      return;
    }
    if (args.testPassed) {
      throw errors[0];
    }
    for (const error of errors) {
      console.warn(`---- teardown error (test already failed): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
