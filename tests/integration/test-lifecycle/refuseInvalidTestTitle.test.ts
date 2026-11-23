import type { CreateTarget, RenameTarget } from '@api/TestsApi';
import type { SeededTest } from '@data/types';
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
  let seed: SeededTest;
  let atcId: string;

  test.beforeAll(async ({ playwright }) => {
    steps = new TestLifecycleSteps({ playwright });
    seeds = new TestSeedSteps();
    member = await steps.openMemberArena();
  });

  test.afterAll(async () => {
    try {
      await seeds?.teardown();
    }
    finally {
      await steps?.release();
    }
  });

  test.beforeEach(async () => {
    seed = await seeds.seedTest({ api: member.api, arena: member.arena, atcs: 1 });
    const [first] = seed.atcIds;
    if (first === undefined) {
      throw new Error('fixture broken: the seeded Test chains no ATC');
    }
    atcId = first;
  });

  async function renamedIds(): Promise<string[]> {
    const [, items] = await member.api.activity.listTestEvents({
      workspaceId: member.arena.workspaceId,
      action: 'test.renamed',
      testId: seed.id,
    });
    return items.map(item => item.id);
  }

  async function createdIds(title: string): Promise<string[]> {
    const [, items] = await member.api.activity.listTestEvents({
      workspaceId: member.arena.workspaceId,
      action: 'test.created',
      title,
    });
    return items.map(item => item.id);
  }

  function newIds(args: { before: string[], after: string[] }): string[] {
    return args.after.filter(id => !args.before.includes(id));
  }

  function renameTarget(): RenameTarget {
    return { kind: 'rename', testId: seed.id, seedTitle: seed.title, seedVersion: seed.version };
  }

  function createTarget(): CreateTarget {
    return { kind: 'create', atcId, workspaceId: member.arena.workspaceId };
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
          const before = await renamedIds();

          await member.api.tests.refuseBlankTitle({ target: renameTarget(), title: row.title });

          expect(newIds({ before, after: await renamedIds() })).toEqual([]);
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
          const before = await createdIds(row.title);

          await member.api.tests.refuseBlankTitle({ target: createTarget(), title: row.title });

          expect(newIds({ before, after: await createdIds(row.title) })).toEqual([]);
        },
      );
    }

    test(
      'BK-2156: should show the required-name message and keep the old name when a blank name is submitted in the rename form',
      { tag: ['@high', '@regression'] },
      async ({ test: kata }) => {
        await kata.ui.testDetail.goto({
          projectSlug: member.arena.project.slug,
          testId: seed.id,
          workspaceId: member.arena.workspaceId,
        });

        await kata.ui.testDetail.expectRenameError({
          title: blankTitles.empty,
          message: TEST_LIFECYCLE.titleRequiredMessage,
        });

        const [, read] = await member.api.tests.getTest(seed.id);
        expect(read.test.title).toBe(seed.title);
        expect(read.test.version).toBe(seed.version);
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
          const eventsOf = async (): Promise<string[]> => (row.endpoint === 'rename' ? renamedIds() : createdIds(title));
          const before = await eventsOf();

          const [, body] = await member.api.tests.applyTitleLengthBoundaries({
            target: row.endpoint === 'rename' ? renameTarget() : createTarget(),
            row,
          });

          if (row.endpoint === 'create' && 'test' in body) {
            seeds.adopt({ api: member.api, testId: body.test.id });
          }
          expect(newIds({ before, after: await eventsOf() })).toHaveLength(row.expectedStatus === 422 ? 0 : 1);
        },
      );
    }
  });
});
