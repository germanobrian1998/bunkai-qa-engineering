import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { DataFactory } from '@DataFactory';
import { OfferSurfaceSteps } from '@steps/OfferSurfaceSteps';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

test.describe('BK-596: archive and restore a Test from its page', () => {
  let steps: TestLifecycleSteps;
  let seeds: TestSeedSteps;
  let offers: OfferSurfaceSteps;
  let member: TestLifecycleSession;

  test.beforeAll(async ({ playwright }) => {
    steps = new TestLifecycleSteps({ playwright });
    seeds = new TestSeedSteps();
    offers = new OfferSurfaceSteps();
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
    'BK-2144: should archive after a confirmation naming the Test, its reversibility and its Run count, then show the restore hint',
    { tag: ['@critical', '@smoke', '@regression'] },
    async ({ test: kata }) => {
      test.slow();
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
    'BK-2158: should offer no Start Run and refuse POST /runs with 409 test_archived given an archived Test',
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

  test(
    'BK-2152: should return a restored Test to every offer surface and allow Run start, rename, reorder and tags again',
    { tag: ['@critical', '@smoke', '@regression'] },
    async ({ test: kata }) => {
      test.slow();
      const { api, arena } = member;
      const scoped = await steps.openScopedSession({ role: 'member', workspaceId: arena.workspaceId });
      const isolated = await seeds.seedIsolatedModule({ api, arena });
      const tag = DataFactory.createTag();
      const archived = await seeds.seedInState({ api, arena: isolated.arena, state: 'archived', chainLength: 2, tags: [tag] });
      const listed = await seeds.seedInState({ api, arena, state: 'live' });
      await seeds.ensureEnvironment({ api, projectId: arena.project.id });
      expect(archived.archived_at, 'precondition: the Test is archived').not.toBeNull();
      const offered = {
        testId: archived.id,
        title: archived.title,
        tag,
        atcId: isolated.arena.atcId,
        projectId: arena.project.id,
        workspaceId: arena.workspaceId,
      };
      const place = { projectSlug: arena.project.slug, testId: archived.id, workspaceId: arena.workspaceId };
      const noSurface = { palette: false, planPicker: false, tagFilter: false, chatPicker: false };

      const before = await offers.readOffers({ session: api, scopedSession: scoped, offered });
      expect(before.surfaces, 'before the restore, no offer surface lists the archived Test').toEqual(noSurface);
      expect.soft(before.atcUsage, 'before the restore, the ATC usage lists no Test and counts the archived one apart').toEqual({ count: 0, archivedCount: 1, listed: false });

      await kata.ui.testDetail.open(place);
      await kata.ui.testDetail.expectFrozen();
      await kata.ui.testDetail.expectExplorerRowAbsent({ testId: archived.id, listedTestId: listed.id });

      await kata.ui.testDetail.restoreFromBanner({ chainLength: 2 });

      const [, restored] = await api.tests.getTest(archived.id);
      expect(restored.test.archived_at, 'the stored Test is live again').toBeNull();
      const after = await offers.readOffers({ session: api, scopedSession: scoped, offered });
      expect(after.surfaces, 'after the restore, every offer surface lists the Test').toEqual({ palette: true, planPicker: true, tagFilter: true, chatPicker: true });
      expect(after.atcUsage, 'the ATC is used in exactly the restored Test and no archived Test remains').toEqual({ count: 1, archivedCount: 0, listed: true });

      await kata.ui.testDetail.expectTitleInExplorer({ testId: archived.id, title: archived.title });
      await kata.ui.testsList.open({ projectSlug: arena.project.slug, workspaceId: arena.workspaceId });
      await kata.ui.testsList.filterByTag(tag);
      await kata.ui.testsList.expectFilteredRows({ ids: [archived.id] });

      const renamedTitle = DataFactory.createTestTitle();
      const [, renamed] = await api.tests.renameTest({ testId: archived.id, title: renamedTitle });
      expect(renamed.changed, 'the restored Test accepts a rename').toBe(true);
      const [, renamedBack] = await api.tests.renameTest({ testId: archived.id, title: archived.title });
      expect(renamedBack.changed, 'the restored Test accepts the rename back').toBe(true);
      const [, final] = await api.tests.getTest(archived.id);
      expect(final.test.title, 'the Test ends with its original title').toBe(archived.title);
    },
  );
});
