/**
 * KATA Architecture - Refused Member Removal Integration Tests
 *
 * Story BK-572 (Remove a teammate from a workspace), ladder refusals.
 * Read-only: every call is refused and the workspace must stay untouched.
 *
 * Tests: BK-1664 (Admin removes the Owner), BK-1665 (Member/Viewer remove anyone).
 * Callers use the role cookie sessions (role-sessions-setup), never a PAT: a
 * PAT without workspace:admin answers 403 missing_capability before the ladder runs.
 *
 * Project: integration-roles (depends on api-setup, role-sessions-setup); @smoke in smoke-roles-api. Staging only.
 */

import type { RemovalFixture } from '@steps/MemberRemovalSteps';
import { MemberRemovalSteps } from '@steps/MemberRemovalSteps';
import { expect, test } from '@TestFixture';

const FIXME_REASON = 'needs a second Member/Viewer account in the fixture workspace: identical to the self row today';

test.describe('BK-572: Member removal is refused below the ladder', () => {
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
    'BK-1664: should refuse with 403 cannot_remove_owner and change nothing when an Admin removes the Owner given a workspace with four active members',
    { tag: ['@critical', '@smoke', '@regression'] },
    async () => {
      const before = await steps.takeSnapshot(fx);

      await fx.sessions.admin.api.workspace.removeOwnerAsAdminRefused({
        workspaceId: fx.workspaceId,
        ownerUserId: fx.userIds.owner,
      });

      const after = await steps.takeSnapshot(fx);
      expect(after.roster).toEqual(before.roster);
      const newActivity = await steps.readNewActivity({ fx, since: before });
      expect(newActivity.filter(item => item.action === 'member.removed')).toHaveLength(0);
    },
  );

  // member -> member and viewer -> viewer resolve to the caller's own id today (one
  // account per role), so they repeat the self rows: fixme until a second account exists.
  const rows = [
    { caller: 'member', target: 'viewer', fixme: false },
    { caller: 'member', target: 'admin', fixme: false },
    { caller: 'member', target: 'member', fixme: true },
    { caller: 'viewer', target: 'member', fixme: false },
    { caller: 'viewer', target: 'viewer', fixme: true },
    { caller: 'member', target: 'self', fixme: false },
    { caller: 'viewer', target: 'self', fixme: false },
  ] as const;

  for (const { caller, target, fixme } of rows) {
    const define = fixme ? test.fixme.bind(test) : test;
    define(
      `BK-1665: should refuse with 403 not_a_member when a ${caller} removes ${target}`,
      { tag: ['@high', '@regression'], annotation: fixme ? { type: 'fixme', description: FIXME_REASON } : [] },
      async () => {
        const before = await steps.takeSnapshot(fx);
        const targetUserId = fx.userIds[target === 'self' ? caller : target];

        await fx.sessions[caller].api.workspace.removeMemberRefusedBelowAdmin({
          workspaceId: fx.workspaceId,
          targetUserId,
        });

        const after = await steps.takeSnapshot(fx);
        expect(after.roster).toEqual(before.roster);
        const newActivity = await steps.readNewActivity({ fx, since: before });
        expect(newActivity.filter(item => item.action === 'member.removed')).toHaveLength(0);
      },
    );
  }
});
