import type { SeededTest } from '@data/types';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { TAG_FILTER_ROWS } from '@data/constants';
import { DataFactory } from '@DataFactory';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

const SIBLING_COUNT = 3;

test.describe('BK-596: Archived Test leaves the tag filter', () => {
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

  async function seedSiblings(sharedTag: string): Promise<SeededTest[]> {
    const siblings: SeededTest[] = [];
    for (let index = 0; index < SIBLING_COUNT; index++) {
      siblings.push(await seeds.seedInState({ api: member.api, arena: member.arena, state: 'live', tags: [sharedTag] }));
    }
    return siblings;
  }

  for (const row of TAG_FILTER_ROWS) {
    test(
      `BK-2146: should drop the archived Test from the tag filter and keep the others in the same order given ${row.label}`,
      { tag: ['@critical', '@regression'] },
      async ({ test: kata }) => {
        const sharedTag = DataFactory.createTag();
        const soloTag = DataFactory.createTag();
        const siblings = await seedSiblings(sharedTag);
        const target = await seeds.seedInState({ api: member.api, arena: member.arena, state: 'live', tags: [sharedTag, soloTag] });
        const untagged = await seeds.seedInState({ api: member.api, arena: member.arena, state: 'live' });
        const tag = row.carriedBy === 'shared' ? sharedTag : soloTag;
        const [, baselineItems] = await member.api.tests.listByTag(tag);
        const baseline = baselineItems.map(item => item.id);
        const remaining = row.carriedBy === 'shared' ? siblings.map(sibling => sibling.id) : [];
        expect(
          baseline.slice().sort(),
          'precondition: the tag filter lists the Test and every sibling that carries the tag',
        ).toEqual([target.id, ...remaining].sort());
        expect(baseline, 'precondition: the live Test without the tag stays out of the tag filter').not.toContain(untagged.id);

        await kata.ui.testsList.open({ projectSlug: member.arena.project.slug, workspaceId: member.arena.workspaceId });
        await kata.ui.testsList.filterByTag(tag);
        await kata.ui.testsList.expectFilteredRows({ ids: baseline });

        await member.api.tests.archiveTest(target.id);
        await member.api.tests.listTagFilterWithoutArchived({ row, tag, testId: target.id, baseline });

        await kata.ui.testsList.open({ projectSlug: member.arena.project.slug, workspaceId: member.arena.workspaceId });
        await kata.ui.testsList.filterByTag(tag);
        await kata.ui.testsList.expectFilteredRows({ ids: baseline.filter(id => id !== target.id) });
      },
    );
  }
});
