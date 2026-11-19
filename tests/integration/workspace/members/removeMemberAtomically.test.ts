/**
 * KATA Architecture - Atomic Member Removal Integration Tests
 *
 * Story BK-572 (AC-07, AC-08, AC-09): one removal is one transaction.
 * Membership gone, workspace-scoped PATs revoked, global PATs untouched, held
 * Bugs unassigned (events, no notifications), authored Bugs intact, one
 * member.removed event.
 *
 * DESTRUCTIVE: removes the fixture Member. Discovery re-admits a missing Member
 * and FAILS ("fixture broken") on any other roster defect; teardown re-admits
 * the Member (Owner invite + Member accept) and revokes what the test minted.
 *
 * Project: integration-roles (depends on api-setup, role-sessions-setup). Not in smoke. Staging only.
 */

import type { RemovalFixture } from '@steps/MemberRemovalSteps';
import { MemberRemovalSteps } from '@steps/MemberRemovalSteps';
import { expect, test } from '@TestFixture';

const rows = [
  { caller: 'the Owner, signed in with their session', channel: 'session' },
  { caller: 'the Owner\'s workspace:admin PAT bound to the workspace', channel: 'pat' },
] as const;

test.describe('BK-572: A member removal is atomic', () => {
  let steps: MemberRemovalSteps;
  let fx: RemovalFixture;

  test.beforeAll(async ({ playwright }) => {
    steps = new MemberRemovalSteps({ playwright });
    fx = await steps.discoverFixture();
  });

  test.afterAll(async () => {
    await fx?.close();
  });

  for (const row of rows) {
    test(
      `BK-1657: should answer 200 with counts and revoke only the workspace-scoped PATs when ${row.caller} removes a Member given the Member holds one scoped PAT and one global PAT`,
      { tag: ['@critical', '@regression'] },
      async () => {
        const caller = await steps.openRoleSession('owner');
        const owner = fx.sessions.owner.api;
        const member = fx.sessions.member.api;
        const ledger = steps.newLedger();
        const disposers = [caller.close];
        let testPassed = false;

        try {
          // Fixture guard: one roster GET, self-heals a lone missing Member, else "fixture broken"
          await steps.ensureFixtureHealthy(fx);
          // eslint-disable-next-line playwright/no-skipped-test -- data guard: skips only when the fixture Member has no second workspace
          test.skip(fx.secondWorkspaceId === null, 'the Member has no second workspace to prove the other workspace is untouched');
          const secondWorkspaceId = fx.secondWorkspaceId as string;

          // Preconditions: clean start, scoped + global PAT, 3 held Bugs, an authored Bug, baselines
          const held = await steps.provisionRemovableMember(fx, ledger);
          if (row.channel === 'pat') {
            [, ledger.ownerPat] = await owner.auth.provisionToken({ scopes: ['workspace:admin'], workspaceId: fx.workspaceId, expiresInDays: 1 });
            caller.api.setAuthToken(ledger.ownerPat.token);
          }
          const before = await steps.takeSnapshot(fx);
          const [, ownerInboxBefore] = await owner.activity.listNotifications(fx.workspaceId);
          const [, memberInboxBefore] = await member.activity.listNotifications(fx.workspaceId);
          const ownerKnownIds = ownerInboxBefore.items.map(item => item.id);
          const memberKnownIds = memberInboxBefore.items.map(item => item.id);

          // ATC
          const [, removal] = await caller.api.workspace.removeMemberSuccessfully({
            workspaceId: fx.workspaceId,
            memberUserId: fx.userIds.member,
          });
          ledger.removalRan = true;

          // Counts
          expect(removal.revoked_token_count).toBe(1);
          expect(removal.unassigned_bug_count).toBe(3);
          expect(removal.revoked_invite_count).toBe(0);

          // Only the workspace-scoped PAT is revoked
          const scoped = await steps.openBearerSession(held.scopedPat.token);
          disposers.push(scoped.close);
          const [scopedResponse, scopedBody] = await scoped.api.workspace.listWorkspaces();
          expect(scopedResponse.status()).toBe(401);
          expect(JSON.stringify(scopedBody)).toContain('Invalid token');

          const global = await steps.openBearerSession(held.globalPat.token);
          disposers.push(global.close);
          const [globalResponse, globalBody] = await global.api.workspace.listWorkspaces();
          expect(globalResponse.status()).toBe(200);
          const visibleIds = globalBody.workspaces.map(workspace => workspace.id);
          expect(visibleIds).toContain(secondWorkspaceId);
          expect(visibleIds).not.toContain(fx.workspaceId);

          // Held Bugs are unassigned, the authored Bug is intact
          for (const bugId of held.heldBugIds) {
            const [, heldBug] = await owner.bug.getBug(bugId);
            expect(heldBug.bug.assignee_user_id).toBeNull();
          }
          const [, authored] = await owner.bug.getBug(held.authoredBugId);
          expect(authored.bug.created_by).toBe(fx.userIds.member);

          // Feed: exactly 3 bug.unassigned (one per held Bug) and 1 member.removed by the caller
          const newItems = await steps.readNewActivity({ fx, since: before });
          const unassigned = newItems.filter(item => item.action === 'bug.unassigned');
          const removed = newItems.filter(item => item.action === 'member.removed');
          expect(unassigned).toHaveLength(3);
          expect(unassigned.map(item => item.item.entity_id).sort()).toEqual([...held.heldBugIds].sort());
          expect(removed).toHaveLength(1);
          expect(removed[0]?.actor.user_id).toBe(fx.userIds.owner);

          // No notification rows: Owner inbox unchanged now; the Member's inbox is empty
          // to them while removed, so it is compared once they are re-admitted
          const [, ownerInboxAfter] = await owner.activity.listNewNotifications({ workspaceId: fx.workspaceId, knownIds: ownerKnownIds });
          expect(ownerInboxAfter.newItems).toHaveLength(0);
          expect(ownerInboxAfter.unreadCount).toBe(ownerInboxBefore.unread_count);
          await steps.readmitMember(fx);
          const [, memberInboxAfter] = await member.activity.listNewNotifications({ workspaceId: fx.workspaceId, knownIds: memberKnownIds });
          expect(memberInboxAfter.newItems).toHaveLength(0);
          expect(memberInboxAfter.unreadCount).toBe(memberInboxBefore.unread_count);
          testPassed = true;
        }
        finally {
          // Teardown: every step independent, disposes last, never masks the test failure
          await steps.teardown({
            tasks: [
              async () => steps.readmitMember(fx),
              async () => steps.releaseLedger(fx, ledger),
            ],
            dispose: disposers,
            testPassed,
          });
        }
      },
    );
  }
});
