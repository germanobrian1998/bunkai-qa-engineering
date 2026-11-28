import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { DataFactory } from '@DataFactory';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

test.describe('BK-596: rename a Test from its page', () => {
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
    'BK-2140: should show the new name on the Test header, Tests list, explorer and search and raise the version by one keeping chain, step ids and tags after a rename by a member',
    { tag: ['@critical', '@smoke', '@regression'] },
    async ({ test: kata }) => {
      test.slow();
      const { api, arena } = member;
      const tags = [DataFactory.createTag(), DataFactory.createTag()];
      const title = DataFactory.createTestTitle();
      const before = await seeds.seedInState({ api, arena, state: 'live', chainLength: 2, tags });
      expect(before.atcs, 'precondition: the Test chains 2 steps').toHaveLength(2);
      expect(before.tags, 'precondition: the Test carries 2 tags').toHaveLength(2);
      const eventsBefore = await api.activity.snapshotTestEvents({ workspaceId: arena.workspaceId, actions: ['test.renamed'], testId: before.id });

      await kata.ui.testDetail.goto({ projectSlug: arena.project.slug, testId: before.id, workspaceId: arena.workspaceId });
      await kata.ui.testDetail.renameFromHeader({ title });

      const [, after] = await api.tests.getTest(before.id);
      expect(after.test.title, 'the stored title is the new one').toBe(title);
      expect(after.test.version, 'the rename raised the version by one').toBe(before.version + 1);
      expect(after.test.atcs.map(atc => atc.step_id), 'the step ids and their order are unchanged').toEqual(before.atcs.map(atc => atc.step_id));
      expect(after.test.atcs.map(atc => atc.position), 'the step positions are unchanged').toEqual(before.atcs.map(atc => atc.position));
      expect(after.test.atcs.map(atc => atc.id), 'the chained ATCs are unchanged').toEqual(before.atcs.map(atc => atc.id));
      expect([...after.test.tags].sort(), 'the tags are unchanged').toEqual([...before.tags].sort());

      await kata.ui.testDetail.expectTitleInExplorer({ testId: before.id, title });

      await kata.ui.testsList.open({ projectSlug: arena.project.slug, workspaceId: arena.workspaceId });
      await kata.ui.testsList.filterByTag(tags[0]);
      await kata.ui.testsList.expectFilteredRows({ ids: [before.id] });
      await kata.ui.testsList.expectRowTitle({ testId: before.id, title });

      const scoped = await steps.openScopedSession({ role: 'member', workspaceId: arena.workspaceId });
      const [, byNewTitle] = await scoped.search.searchPalette(title);
      expect(
        byNewTitle.data.some(item => item.entity_type === 'test' && item.id === before.id),
        'workspace search finds the Test under its new title',
      ).toBe(true);
      const [, byOldTitle] = await scoped.search.searchPalette(before.title);
      expect(
        byOldTitle.data.some(item => item.id === before.id),
        'workspace search no longer finds the Test under its old title',
      ).toBe(false);
      const [, projectSearch] = await api.tests.searchTests({ title, projectId: arena.project.id });
      expect(
        projectSearch.items.some(item => item.id === before.id),
        'the project Test search finds the Test under its new title',
      ).toBe(true);

      const events = await api.activity.listNewTestActivity({
        workspaceId: arena.workspaceId,
        actions: ['test.renamed'],
        testId: before.id,
        knownIds: eventsBefore,
      });
      expect(events, 'exactly one test.renamed event was recorded').toHaveLength(1);
      const [event] = events;
      expect(event.action === 'test.renamed' ? event.payload : null, 'the event records the old and the new title').toEqual({
        old_title: before.title,
        new_title: title,
      });
    },
  );
});
