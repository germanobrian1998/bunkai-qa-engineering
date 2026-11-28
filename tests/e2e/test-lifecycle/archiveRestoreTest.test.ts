import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

test.describe('BK-596: archive a Test from its page', () => {
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
    'BK-2144: should archive the Test and keep its Runs readable once a member confirms the archive dialog given a live Test with 2 finished Runs',
    { tag: ['@critical', '@smoke', '@regression'] },
    async ({ test: kata }) => {
      const { api, arena } = member;
      const seed = await seeds.seedWithHistory({ api, arena, chainLength: 2, tags: [], finishedRuns: 2, plans: 0 });
      expect(seed.run_count, 'precondition: the Test has 2 finished Runs').toBe(2);
      const eventsBefore = await api.activity.snapshotTestEvents({ workspaceId: arena.workspaceId, actions: ['test.archived'], testId: seed.id });

      await kata.ui.testDetail.goto({ projectSlug: arena.project.slug, testId: seed.id, workspaceId: arena.workspaceId });
      await kata.ui.testDetail.archiveFromTestPage({ title: seed.title, runCount: 2 });

      const [, me] = await api.auth.getCurrentUser();
      const [, after] = await api.tests.getTest(seed.id);
      expect(after.test.archived_at, 'the Test is archived').not.toBeNull();
      expect(after.test.archived_by, 'the Test records who archived it').toBe(me.user.id);
      const events = await api.activity.listNewTestActivity({
        workspaceId: arena.workspaceId,
        actions: ['test.archived'],
        testId: seed.id,
        knownIds: eventsBefore,
      });
      expect(events, 'exactly one test.archived event was recorded').toHaveLength(1);
      const [event] = events;
      expect(event.action === 'test.archived' ? event.payload.title : null, 'the event names the archived Test').toBe(seed.title);
      const [, runs] = await api.tests.listRunHistory(seed.id);
      expect(runs, 'the 2 finished Runs are still listed after the archive').toHaveLength(2);
    },
  );

  test(
    'BK-2158: should offer no Start Run and refuse POST /runs with 409 test_archived when a member reaches an archived Test that was never run',
    { tag: ['@critical', '@regression'] },
    async ({ test: kata }) => {
      test.slow();
      const { api, arena } = member;
      const seed = await seeds.seedInState({ api, arena, state: 'live' });
      const environmentId = await seeds.ensureEnvironment({ api, projectId: arena.project.id });
      const place = { projectSlug: arena.project.slug, testId: seed.id, workspaceId: arena.workspaceId };

      await kata.ui.testDetail.goto(place);
      await kata.ui.testDetail.expectStartRunOffered();

      await api.tests.archiveTest(seed.id);
      await kata.ui.testDetail.open(place);
      await kata.ui.testDetail.expectNoStartRun();

      await api.runs.refuseRunFromArchivedTest({ testId: seed.id, environmentId });

      const [, runs] = await api.runs.readWorkspaceRuns({
        workspaceId: arena.workspaceId,
        projectId: arena.project.id,
        testId: seed.id,
        since: seed.created_at,
      });
      expect(runs.rows, 'no Run was created for the archived Test').toEqual([]);
    },
  );
});
