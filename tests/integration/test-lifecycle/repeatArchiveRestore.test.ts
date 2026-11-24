import type { FirstArchive } from '@api/TestsApi';
import type { SeededTest } from '@data/types';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

const RECORD_COUNTS = { chainLength: 2, finishedRuns: 2, plans: 3 } as const;

function firstArchiveOf(seed: SeededTest): FirstArchive {
  if (seed.archived_at === null || seed.archived_by === null) {
    throw new Error(`fixture broken: Test ${seed.id} is not archived`);
  }
  return { archivedAt: seed.archived_at, archivedBy: seed.archived_by };
}

test.describe('BK-596: Archive and restore repeats', () => {
  let steps: TestLifecycleSteps;
  let seeds: TestSeedSteps;
  let member: TestLifecycleSession;

  test.beforeAll(async ({ playwright }) => {
    steps = new TestLifecycleSteps({ playwright });
    seeds = new TestSeedSteps();
    member = await steps.openMemberArena();
  });

  test.afterAll(async () => {
    const errors: unknown[] = [];
    try {
      await seeds?.teardown();
    }
    catch (error) {
      errors.push(error);
    }
    finally {
      try {
        await steps?.release();
      }
      catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, `afterAll failed: ${errors.length} teardown error(s)`);
    }
  });

  test(
    'BK-2171: should answer 204 to a second archive and keep the first archive time and actor with no second event given an already archived Test',
    { tag: ['@high', '@regression'] },
    async () => {
      const admin = await steps.openRoleSession({ role: 'admin' });
      const seed = await seeds.seedInState({ api: member.api, arena: member.arena, state: 'archived' });
      const firstArchive = firstArchiveOf(seed);
      const [, memberMe] = await member.api.auth.getCurrentUser();
      const [, adminMe] = await admin.auth.getCurrentUser();
      expect(firstArchive.archivedBy, 'precondition: the member made the first archive').toBe(memberMe.user.id);
      expect(adminMe.user.id, 'precondition: the second archive comes from another actor').not.toBe(memberMe.user.id);
      const eventsBefore = await member.api.activity.snapshotTestEvents({
        workspaceId: member.arena.workspaceId,
        actions: ['test.archived'],
        testId: seed.id,
      });
      expect(eventsBefore, 'precondition: the first archive wrote one event').toHaveLength(1);

      await admin.tests.archiveAgainKeepsFirstArchive({ testId: seed.id, firstArchive });

      const eventsAfter = await member.api.activity.snapshotTestEvents({
        workspaceId: member.arena.workspaceId,
        actions: ['test.archived'],
        testId: seed.id,
      });
      expect(eventsAfter, 'a second archive must not write a second test.archived event').toEqual(eventsBefore);
    },
  );

  test(
    'BK-2172: should answer 200 with changed false and write no event when restoring a live Test',
    { tag: ['@medium', '@regression'] },
    async () => {
      const seed = await seeds.seedInState({ api: member.api, arena: member.arena, state: 'live' });
      expect(seed.archived_at, 'precondition: the Test is live').toBeNull();
      const eventsBefore = await member.api.activity.snapshotTestEvents({
        workspaceId: member.arena.workspaceId,
        actions: ['test.restored'],
        testId: seed.id,
      });

      await member.api.tests.restoreLiveTestChangesNothing({ testId: seed.id, versionBefore: seed.version });

      const newEvents = await member.api.activity.listNewTestEvents({
        workspaceId: member.arena.workspaceId,
        actions: ['test.restored'],
        testId: seed.id,
        knownIds: eventsBefore,
      });
      expect(newEvents, 'restoring a live Test must not write a test.restored event').toEqual([]);
    },
  );

  test(
    'BK-2153: should keep the Test row and every Run, step and plan membership unchanged across archive and restore',
    { tag: ['@critical', '@regression'] },
    async () => {
      const seed = await seeds.seedWithHistory({
        api: member.api,
        arena: member.arena,
        chainLength: RECORD_COUNTS.chainLength,
        tags: ['bk596-keep'],
        finishedRuns: RECORD_COUNTS.finishedRuns,
        plans: RECORD_COUNTS.plans,
      });
      expect(seed.atcs, 'precondition: the chain holds 2 steps').toHaveLength(RECORD_COUNTS.chainLength);
      expect(seed.run_count, 'precondition: the Test has 2 finished Runs').toBe(RECORD_COUNTS.finishedRuns);
      expect(seed.plans, 'precondition: 3 plans hold the Test').toHaveLength(RECORD_COUNTS.plans);
      expect(seed.tags, 'precondition: the Test carries its tag').toEqual(['bk596-keep']);

      const [, restored] = await member.api.tests.keepRecordsAcrossArchiveAndRestore({ testId: seed.id });

      expect(restored.test.title).toBe(seed.title);
      expect(restored.test.run_count).toBe(seed.run_count);
      expect(restored.test.plans.map(plan => plan.id).sort()).toEqual(seed.plans.map(plan => plan.id).sort());
    },
  );
});
