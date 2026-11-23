import type { SeededTest } from '@data/types';
import type { CreateTestResponse } from '@schemas/tests.types';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { TEST_LIFECYCLE } from '@data/constants';
import { DataFactory } from '@DataFactory';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

const { blankTitles, characters } = TEST_LIFECYCLE;

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
    await seeds?.teardown();
    await steps?.release();
  });

  async function seedWithAtc(): Promise<{ seed: SeededTest, atcId: string }> {
    const seed = await seeds.seedTest({ api: member.api, arena: member.arena, atcs: 1 });
    const [atcId] = seed.atcIds;
    if (atcId === undefined) {
      throw new Error('fixture broken: the seeded Test chains no ATC');
    }
    return { seed, atcId };
  }

  async function eventIds(args: { action: 'test.renamed' | 'test.created', testId?: string }): Promise<string[]> {
    const [, items] = await member.api.activity.listTestEvents({ workspaceId: member.arena.workspaceId, ...args });
    return items.map(item => item.id);
  }

  test.describe('BK-2156: blank titles', () => {
    let seed: SeededTest;
    let atcId: string;

    test.beforeAll(async () => {
      ({ seed, atcId } = await seedWithAtc());
    });

    const renameRows = [
      { label: 'an empty string', title: blankTitles.empty, withUi: true },
      { label: '3 space characters', title: blankTitles.spaces, withUi: false },
      { label: '2 tab characters', title: blankTitles.tabs, withUi: false },
      { label: '2 non-breaking spaces', title: blankTitles.nonBreakingSpaces, withUi: false },
    ];

    for (const row of renameRows) {
      test(
        `BK-2156: should refuse a blank name with a required-name error (422) and keep the old name when a rename carries ${row.label}`,
        { tag: ['@high', '@regression'] },
        async ({ test: kata }) => {
          const renamedBefore = await eventIds({ action: 'test.renamed', testId: seed.id });

          await member.api.tests.refuseBlankTitle({ operation: 'rename', testId: seed.id, title: row.title });

          const [, after] = await member.api.tests.getTest(seed.id);
          expect(after.test.title).toBe(seed.title);
          expect(after.test.version).toBe(seed.version);
          expect(await eventIds({ action: 'test.renamed', testId: seed.id })).toEqual(renamedBefore);

          if (row.withUi) {
            await kata.ui.testDetail.goto({
              projectSlug: member.arena.project.slug,
              testId: seed.id,
              workspaceId: member.arena.workspaceId,
            });
            await kata.ui.testDetail.expectRenameError({ title: row.title, message: TEST_LIFECYCLE.titleRequiredMessage });
          }
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
          const createdBefore = await eventIds({ action: 'test.created' });

          await member.api.tests.refuseBlankTitle({
            operation: 'create',
            atcId,
            workspaceId: member.arena.workspaceId,
            title: row.title,
          });

          expect(await eventIds({ action: 'test.created' })).toEqual(createdBefore);
        },
      );
    }
  });

  test.describe('BK-2167: title length limit', () => {
    let seed: SeededTest;
    let atcId: string;

    test.beforeAll(async () => {
      ({ seed, atcId } = await seedWithAtc());
    });

    test.afterAll(async () => {
      await member.api.tests.renameTest({ testId: seed.id, title: seed.title });
      const [, restored] = await member.api.tests.getTest(seed.id);
      expect(restored.test.title).toBe(seed.title);
    });

    const acceptedRenames = [
      { label: '199 ASCII characters', character: characters.ascii, count: 199 },
      { label: '200 ASCII characters', character: characters.ascii, count: 200 },
      { label: '200 accented characters', character: characters.accented, count: 200 },
      { label: '200 emoji', character: characters.emoji, count: 200 },
    ];

    for (const row of acceptedRenames) {
      test(
        `BK-2167: should accept a title of ${row.label} at rename`,
        { tag: ['@high', '@regression'] },
        async () => {
          const renamedBefore = await eventIds({ action: 'test.renamed', testId: seed.id });

          await member.api.tests.applyTitleLengthRule({
            operation: 'rename',
            testId: seed.id,
            character: row.character,
            count: row.count,
            expectedStatus: 200,
          });

          const [, read] = await member.api.tests.getTest(seed.id);
          expect(read.test.title).toBe(DataFactory.createTitleOfLength(row));
          expect([...read.test.title]).toHaveLength(row.count);
          const renamedAfter = await eventIds({ action: 'test.renamed', testId: seed.id });
          expect(renamedAfter.filter(id => !renamedBefore.includes(id))).toHaveLength(1);
        },
      );
    }

    const refusedRenames = [
      { label: '201 ASCII characters', character: characters.ascii, count: 201 },
      { label: '201 emoji', character: characters.emoji, count: 201 },
    ];

    for (const row of refusedRenames) {
      test(
        `BK-2167: should refuse with a too-long error (422) a title of ${row.label} at rename and keep the old title`,
        { tag: ['@high', '@regression'] },
        async () => {
          const [, before] = await member.api.tests.getTest(seed.id);
          const renamedBefore = await eventIds({ action: 'test.renamed', testId: seed.id });

          await member.api.tests.applyTitleLengthRule({
            operation: 'rename',
            testId: seed.id,
            character: row.character,
            count: row.count,
            expectedStatus: 422,
          });

          const [, after] = await member.api.tests.getTest(seed.id);
          expect(after.test.title).toBe(before.test.title);
          expect(after.test.version).toBe(before.test.version);
          expect(await eventIds({ action: 'test.renamed', testId: seed.id })).toEqual(renamedBefore);
        },
      );
    }

    test(
      'BK-2167: should accept a title of 200 emoji at create',
      { tag: ['@high', '@regression'] },
      async () => {
        const createdBefore = await eventIds({ action: 'test.created' });

        const [, body] = await member.api.tests.applyTitleLengthRule({
          operation: 'create',
          atcId,
          workspaceId: member.arena.workspaceId,
          character: characters.emoji,
          count: 200,
          expectedStatus: 201,
        });

        const created = body as CreateTestResponse;
        seeds.adopt({ api: member.api, testId: created.test.id });
        const [, read] = await member.api.tests.getTest(created.test.id);
        expect(read.test.title).toBe(DataFactory.createTitleOfLength({ character: characters.emoji, count: 200 }));
        const createdAfter = await eventIds({ action: 'test.created' });
        expect(createdAfter.filter(id => !createdBefore.includes(id))).toHaveLength(1);
      },
    );

    test(
      'BK-2167: should refuse with a too-long error (422) a title of 201 emoji at create and create no Test',
      { tag: ['@high', '@regression'] },
      async () => {
        const createdBefore = await eventIds({ action: 'test.created' });

        await member.api.tests.applyTitleLengthRule({
          operation: 'create',
          atcId,
          workspaceId: member.arena.workspaceId,
          character: characters.emoji,
          count: 201,
          expectedStatus: 422,
        });

        expect(await eventIds({ action: 'test.created' })).toEqual(createdBefore);
      },
    );
  });
});
