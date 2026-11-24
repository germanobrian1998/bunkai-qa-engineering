import type { CreateTarget, RenameTarget } from '@api/TestsApi';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { TEST_LIFECYCLE, TITLE_LENGTH_ROWS } from '@data/constants';
import { DataFactory } from '@DataFactory';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

const { blankTitles } = TEST_LIFECYCLE;

test.describe('BK-596: Test title validation', () => {
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

  async function seedRenameTarget(): Promise<RenameTarget> {
    const seed = await seeds.seedTest({ api: member.api, arena: member.arena });
    return { kind: 'rename', testId: seed.id, seedTitle: seed.title, seedVersion: seed.version };
  }

  async function renamedIds(testId: string): Promise<string[]> {
    const [, items] = await member.api.activity.listTestEvents({
      workspaceId: member.arena.workspaceId,
      action: 'test.renamed',
      testId,
    });
    return items.map(item => item.id);
  }

  async function createdIds(): Promise<string[]> {
    const [, items] = await member.api.activity.listTestEvents({
      workspaceId: member.arena.workspaceId,
      action: 'test.created',
    });
    return items.map(item => item.id);
  }

  function newIds(args: { before: string[], after: string[] }): string[] {
    return args.after.filter(id => !args.before.includes(id));
  }

  function createTarget(): CreateTarget {
    return {
      kind: 'create',
      atcId: member.arena.atcId,
      workspaceId: member.arena.workspaceId,
      onCreated: testId => seeds.adopt({ api: member.api, testId }),
    };
  }

  test.describe('BK-2156: blank titles', () => {
    const renameRows = [
      { label: 'an empty string', title: blankTitles.empty },
      { label: '3 space characters', title: blankTitles.spaces },
      { label: '2 tab characters', title: blankTitles.tabs },
      { label: '2 non-breaking spaces', title: blankTitles.nonBreakingSpaces },
    ];

    for (const row of renameRows) {
      test(
        `BK-2156: should refuse a blank name with a required-name error (422) and keep the old name when a rename carries ${row.label}`,
        { tag: ['@high', '@regression'] },
        async () => {
          const target = await seedRenameTarget();
          const before = await renamedIds(target.testId);

          await member.api.tests.refuseBlankTitle({ target, title: row.title });

          expect(newIds({ before, after: await renamedIds(target.testId) })).toEqual([]);
        },
      );
    }

    const createRows = [
      { label: 'an empty string', title: blankTitles.empty },
      { label: '2 non-breaking spaces', title: blankTitles.nonBreakingSpaces },
    ];

    for (const row of createRows) {
      test(
        `BK-2156: should refuse a blank name with a required-name error (422) and create no Test when a create carries ${row.label}`,
        { tag: ['@high', '@regression'] },
        async () => {
          const before = await createdIds();

          await member.api.tests.refuseBlankTitle({ target: createTarget(), title: row.title });

          expect(newIds({ before, after: await createdIds() })).toEqual([]);
        },
      );
    }

    test(
      'BK-2156: should show the required-name message and send no rename request when a blank name is submitted in the rename form',
      { tag: ['@high', '@regression'] },
      async ({ test: kata }) => {
        const target = await seedRenameTarget();
        await kata.ui.testDetail.goto({
          projectSlug: member.arena.project.slug,
          testId: target.testId,
          workspaceId: member.arena.workspaceId,
        });

        await kata.ui.testDetail.expectBlankRenameBlocked({
          testId: target.testId,
          message: TEST_LIFECYCLE.titleRequiredMessage,
        });
      },
    );
  });

  test.describe('BK-2167: title length limit', () => {
    for (const row of TITLE_LENGTH_ROWS) {
      const outcome = row.expectedStatus === 422 ? 'refuse with a too-long error (422)' : 'accept';
      test(
        `BK-2167: should ${outcome} a title of ${row.label} when a member ${row.endpoint === 'rename' ? 'renames' : 'creates'} a Test`,
        { tag: ['@high', '@regression'] },
        async () => {
          const title = DataFactory.createTitleOfLength(row);
          const target = row.endpoint === 'rename' ? await seedRenameTarget() : createTarget();
          const eventsOf = async (): Promise<string[]> => (target.kind === 'rename' ? renamedIds(target.testId) : createdIds());
          const before = await eventsOf();

          await member.api.tests.applyTitleLengthBoundaries({ target, row, title });

          expect(newIds({ before, after: await eventsOf() })).toHaveLength(row.expectedStatus === 422 ? 0 : 1);
        },
      );
    }
  });
});
