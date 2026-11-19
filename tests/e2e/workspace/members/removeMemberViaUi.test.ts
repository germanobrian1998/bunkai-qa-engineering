/**
 * KATA Architecture - Remove Member via UI E2E Test
 *
 * Story BK-572 (AC-06, AC-16): the Owner removes the Member on the Members
 * screen; the Member's access ends at once while their other workspace stays.
 *
 * DESTRUCTIVE: removes the fixture Member. Discovery re-admits a missing Member
 * and FAILS ("fixture broken") on any other roster defect; teardown re-admits
 * the Member so the workspace ends with its four role accounts.
 *
 * Verification of "gone from the database" and "next load" goes through API
 * proxies (roster, Member GET workspace, Member /me). Token and Bug side
 * effects are asserted by BK-1657, not here.
 *
 * Project: e2e-roles (depends on ui-setup, role-sessions-setup); @smoke in smoke-roles-ui. Staging only.
 */

import type { RemovalFixture } from '@steps/MemberRemovalSteps';
import { MemberRemovalSteps } from '@steps/MemberRemovalSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-572: Remove a member from the Members screen', () => {
  let steps: MemberRemovalSteps;
  let fx: RemovalFixture;

  test.beforeAll(async ({ playwright }) => {
    steps = new MemberRemovalSteps({ playwright });
    fx = await steps.discoverFixture();
  });

  test.afterAll(async () => {
    await fx?.close();
  });

  test(
    'BK-1656: should end the Member\'s access at once and keep their other workspace when the Owner confirms the removal in the UI',
    { tag: ['@critical', '@smoke', '@regression'] },
    async ({ test: kata }) => {
      const memberApi = fx.sessions.member.api;
      let testPassed = false;

      try {
        // Fixture guard: one roster GET, self-heals a lone missing Member, else "fixture broken"
        await steps.ensureFixtureHealthy(fx);
        // eslint-disable-next-line playwright/no-skipped-test -- data guard: skips only when the fixture Member has no second workspace
        test.skip(fx.secondWorkspaceId === null, 'the Member has no second workspace to prove the other workspace is untouched');
        const secondWorkspaceId = fx.secondWorkspaceId as string;

        await kata.ui.members.goto(fx.workspaceId);
        await kata.ui.members.removeMemberViaConfirmation({
          workspaceId: fx.workspaceId,
          memberEmail: fx.sessions.member.email,
        });

        // Roster no longer lists the Member
        const [, roster] = await fx.sessions.owner.api.workspace.listMembers(fx.workspaceId);
        expect(roster.members.map(member => member.user_id)).not.toContain(fx.userIds.member);

        // Member: fixture workspace is gone, second workspace remains
        const [workspaceResponse] = await memberApi.workspace.getWorkspace(fx.workspaceId);
        expect(workspaceResponse.status()).toBe(404);
        const [, me] = await memberApi.auth.getCurrentUser();
        const visibleIds = me.workspaces.map(workspace => workspace.id);
        expect(visibleIds).not.toContain(fx.workspaceId);
        expect(visibleIds).toContain(secondWorkspaceId);
        testPassed = true;
      }
      finally {
        await steps.teardown({
          tasks: [async () => steps.readmitMember(fx)],
          dispose: [],
          testPassed,
        });
      }
    },
  );
});
