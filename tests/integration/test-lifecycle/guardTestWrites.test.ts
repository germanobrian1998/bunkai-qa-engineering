import type { SeededTest } from '@data/types';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { FROZEN_WRITE_ROWS, NON_MEMBER_ROWS, TEST_LIFECYCLE, VIEWER_WRITE_ROWS } from '@data/constants';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

test.describe('BK-596: Test write guards', () => {
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

  const writeActions = ['test.renamed', 'test.archived', 'test.restored'] as const;

  async function eventIds(args: { session: TestLifecycleSession, testId: string }): Promise<string[]> {
    return args.session.api.activity.snapshotTestEvents({
      workspaceId: args.session.arena.workspaceId,
      actions: [...writeActions],
      testId: args.testId,
    });
  }

  async function newEventIds(args: { session: TestLifecycleSession, testId: string, before: string[] }): Promise<string[]> {
    return args.session.api.activity.listNewTestEvents({
      workspaceId: args.session.arena.workspaceId,
      actions: [...writeActions],
      testId: args.testId,
      knownIds: args.before,
    });
  }

  test.describe('BK-2161: archived Test is frozen', () => {
    let liveSeed: SeededTest;

    test.beforeAll(async () => {
      liveSeed = await seeds.seedInState({
        api: member.api,
        arena: member.arena,
        state: 'live',
        chainLength: 2,
        tags: [...TEST_LIFECYCLE.seedTags],
      });
    });

    for (const row of FROZEN_WRITE_ROWS) {
      test(
        `BK-2161: should refuse ${row.label} with a 409 archived error and keep the version, title, chain and tags given an archived Test`,
        { tag: ['@critical', '@regression'] },
        async ({ test: kata }) => {
          const seed = await seeds.seedInState({
            api: member.api,
            arena: member.arena,
            state: 'archived',
            chainLength: 2,
            tags: [...TEST_LIFECYCLE.seedTags],
          });
          const [, before] = await member.api.tests.getTest(seed.id);
          expect(before.test.atcs, 'precondition: the archived Test chains 2 steps').toHaveLength(2);
          const eventsBefore = await eventIds({ session: member, testId: seed.id });

          await member.api.tests.refuseWriteOnArchivedTest({
            testId: seed.id,
            row,
            stepIds: before.test.atcs.map(atc => atc.step_id),
          });

          const [, after] = await member.api.tests.getTest(seed.id);
          expect(after.test.version).toBe(before.test.version);
          expect(after.test.title).toBe(before.test.title);
          expect(after.test.atcs.map(atc => atc.step_id)).toEqual(before.test.atcs.map(atc => atc.step_id));
          expect(after.test.tags).toEqual(before.test.tags);
          expect(await newEventIds({ session: member, testId: seed.id, before: eventsBefore })).toEqual([]);

          await kata.ui.testDetail.open({
            projectSlug: member.arena.project.slug,
            testId: liveSeed.id,
            workspaceId: member.arena.workspaceId,
          });
          await kata.ui.testDetail.expectEditControlsOffered();
          await kata.ui.testDetail.open({
            projectSlug: member.arena.project.slug,
            testId: seed.id,
            workspaceId: member.arena.workspaceId,
          });
          await kata.ui.testDetail.expectFrozen();
        },
      );
    }
  });

  test.describe('BK-2163: viewer is refused', () => {
    for (const row of VIEWER_WRITE_ROWS) {
      test(
        `BK-2163: should offer a workspace viewer no rename, archive or restore control and refuse ${row.label} with 403`,
        { tag: ['@critical', '@regression'] },
        async ({ browser, test: kata }) => {
          const viewer = await steps.openRoleSession({ role: 'viewer' });
          const seed = await seeds.seedInState({ api: member.api, arena: member.arena, state: row.state });
          const [, before] = await member.api.tests.getTest(seed.id);
          const eventsBefore = await eventIds({ session: member, testId: seed.id });

          await kata.ui.testDetail.open({
            projectSlug: member.arena.project.slug,
            testId: seed.id,
            workspaceId: member.arena.workspaceId,
          });
          await kata.ui.testDetail.expectLifecycleControlOffered(row.state);
          const viewerPage = await steps.openRoleTestDetail({ browser, role: 'viewer' });
          await viewerPage.open({
            projectSlug: member.arena.project.slug,
            testId: seed.id,
            workspaceId: member.arena.workspaceId,
          });
          await viewerPage.expectNoWriteControls();
          await viewer.tests.refuseWriteByViewer({ testId: seed.id, row });

          const [, after] = await member.api.tests.getTest(seed.id);
          expect(after.test.title).toBe(before.test.title);
          expect(after.test.version).toBe(before.test.version);
          expect(after.test.archived_at).toBe(before.test.archived_at);
          expect(await newEventIds({ session: member, testId: seed.id, before: eventsBefore })).toEqual([]);
        },
      );
    }
  });

  test.describe('BK-2164: non-member sees nothing', () => {
    let foreign: TestLifecycleSession;

    test.beforeAll(async () => {
      foreign = await steps.openForeignArena();
    });

    for (const row of NON_MEMBER_ROWS) {
      test(
        `BK-2164: should answer 404 and hide ${row.label} from search for a workspace non-member, the same as for a missing Test`,
        { tag: ['@critical', '@regression'] },
        async () => {
          const viewer = await steps.openRoleSession({ role: 'viewer', workspaceId: foreign.arena.workspaceId });
          const seed = await seeds.seedInState({ api: foreign.api, arena: foreign.arena, state: row.state });
          const [, ownerSearch] = await foreign.api.tests.searchTests({ title: seed.title, projectId: foreign.arena.project.id });
          expect(
            ownerSearch.items.some(item => item.id === seed.id),
            'the owner side search finds a live Test and hides an archived one',
          ).toBe(row.state === 'live');
          const [, ownerPalette] = await foreign.api.tests.searchPalette(seed.title);
          expect(
            ownerPalette.data.some(item => item.id === seed.id),
            'the owner side palette finds a live Test and hides an archived one',
          ).toBe(row.state === 'live');

          await viewer.tests.hideTestFromNonMember({
            testId: seed.id,
            title: seed.title,
            projectId: foreign.arena.project.id,
            row,
          });
        },
      );
    }
  });

  test.describe('BK-2165: stale version', () => {
    test(
      'BK-2165: should refuse a rename carrying a stale version with a 409 version conflict and the current version given a Test changed after it was read',
      { tag: ['@high', '@regression'] },
      async () => {
        const seed = await seeds.seedTest({ api: member.api, arena: member.arena });
        await member.api.tests.setTags({ testId: seed.id, tags: [...TEST_LIFECYCLE.staleTags] });
        const [, before] = await member.api.tests.getTest(seed.id);
        expect(before.test.version, 'precondition: the tag change raised the version by one').toBe(seed.version + 1);
        const eventsBefore = await eventIds({ session: member, testId: seed.id });

        try {
          await member.api.tests.refuseStaleVersionRename({ testId: seed.id, staleVersion: seed.version });

          const [, after] = await member.api.tests.getTest(seed.id);
          expect(after.test.title).toBe(seed.title);
          expect(after.test.version).toBe(before.test.version);
          expect(await newEventIds({ session: member, testId: seed.id, before: eventsBefore })).toEqual([]);
        }
        finally {
          await member.api.tests.setTags({ testId: seed.id, tags: [] });
        }
      },
    );
  });
});
