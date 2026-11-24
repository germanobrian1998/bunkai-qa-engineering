import type { ApiFixture } from '@ApiFixture';
import type { SeededTest } from '@data/types';
import type { ActivityItem } from '@schemas/workspace.types';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { FROZEN_RENAME_ROW, FROZEN_WRITE_ROWS, NON_MEMBER_ROWS, TEST_LIFECYCLE, VIEWER_WRITE_ROWS } from '@data/constants';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

type ActivityAction = ActivityItem['action'];

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

  async function eventIds(args: { session: TestLifecycleSession, testId: string, actions: readonly ActivityAction[] }): Promise<string[]> {
    return args.session.api.activity.snapshotTestEvents({
      workspaceId: args.session.arena.workspaceId,
      actions: [...args.actions],
      testId: args.testId,
    });
  }

  async function newEventIds(
    args: { session: TestLifecycleSession, testId: string, actions: readonly ActivityAction[], before: string[] },
  ): Promise<string[]> {
    return args.session.api.activity.listNewTestEvents({
      workspaceId: args.session.arena.workspaceId,
      actions: [...args.actions],
      testId: args.testId,
      knownIds: args.before,
    });
  }

  test.describe('BK-2161: archived Test is frozen', () => {
    async function seedArchivedChain(): Promise<SeededTest> {
      const seed = await seeds.seedInState({
        api: member.api,
        arena: member.arena,
        state: 'archived',
        chainLength: 2,
        tags: [...TEST_LIFECYCLE.seedTags],
      });
      expect(seed.atcs, 'precondition: the archived Test chains 2 steps').toHaveLength(2);
      expect(seed.tags, 'precondition: the archived Test carries the seeded tags').toEqual([...TEST_LIFECYCLE.seedTags]);
      return seed;
    }

    async function expectUntouched(args: { id: string, before: SeededTest }): Promise<void> {
      const [, after] = await member.api.tests.getTest(args.id);
      expect(after.test.version, 'a refused write must not raise the version').toBe(args.before.version);
      expect(after.test.updated_at, 'a refused write must not touch updated_at').toBe(args.before.updated_at);
      expect(after.test.title).toBe(args.before.title);
      expect(after.test.atcs.map(atc => atc.step_id)).toEqual(args.before.atcs.map(atc => atc.step_id));
      expect(after.test.tags).toEqual(args.before.tags);
    }

    test(
      `BK-2161: should refuse ${FROZEN_RENAME_ROW.label} with a 409 archived error and keep the version, updated_at, title, chain, tags and activity given an archived Test`,
      { tag: ['@critical', '@regression'] },
      async () => {
        const seed = await seedArchivedChain();
        const eventsBefore = await eventIds({ session: member, testId: seed.id, actions: FROZEN_RENAME_ROW.watchedActions });

        await member.api.tests.refuseWriteOnArchivedTest({
          testId: seed.id,
          row: FROZEN_RENAME_ROW,
          stepIds: seed.atcs.map(atc => atc.step_id),
        });

        await expectUntouched({ id: seed.id, before: seed });
        expect(
          await newEventIds({ session: member, testId: seed.id, actions: FROZEN_RENAME_ROW.watchedActions, before: eventsBefore }),
          'a refused rename must not emit test.renamed',
        ).toEqual([]);
      },
    );

    for (const row of FROZEN_WRITE_ROWS) {
      test(
        `BK-2161: should refuse ${row.label} with a 409 archived error and keep the version, updated_at, title, chain and tags given an archived Test`,
        { tag: ['@critical', '@regression'] },
        async () => {
          const seed = await seedArchivedChain();

          await member.api.tests.refuseWriteOnArchivedTest({
            testId: seed.id,
            row,
            stepIds: seed.atcs.map(atc => atc.step_id),
          });

          await expectUntouched({ id: seed.id, before: seed });
        },
      );
    }

    test(
      'BK-2161: should offer a member the edit controls on a live Test and none on an archived Test',
      { tag: ['@critical', '@regression'] },
      async ({ test: kata }) => {
        const live = await seeds.seedInState({ api: member.api, arena: member.arena, state: 'live', chainLength: 2, tags: [...TEST_LIFECYCLE.seedTags] });
        const archived = await seeds.seedInState({ api: member.api, arena: member.arena, state: 'archived', chainLength: 2, tags: [...TEST_LIFECYCLE.seedTags] });

        await kata.ui.testDetail.open({ projectSlug: member.arena.project.slug, testId: live.id, workspaceId: member.arena.workspaceId });
        await kata.ui.testDetail.expectEditControlsOffered();
        await kata.ui.testDetail.open({ projectSlug: member.arena.project.slug, testId: archived.id, workspaceId: member.arena.workspaceId });
        await kata.ui.testDetail.expectFrozen();
      },
    );
  });

  test.describe('BK-2163: viewer is refused', () => {
    let viewer: ApiFixture;

    test.beforeAll(async () => {
      viewer = await steps.openRoleSession({ role: 'viewer' });
    });

    for (const row of VIEWER_WRITE_ROWS) {
      test(
        `BK-2163: should offer a workspace viewer no rename, archive or restore control and refuse ${row.label} with 403`,
        { tag: ['@critical', '@regression'] },
        async ({ browser, test: kata }, testInfo) => {
          const seed = await seeds.seedInState({ api: member.api, arena: member.arena, state: row.state });
          const eventsBefore = await eventIds({ session: member, testId: seed.id, actions: writeActions });

          await kata.ui.testDetail.open({
            projectSlug: member.arena.project.slug,
            testId: seed.id,
            workspaceId: member.arena.workspaceId,
          });
          await kata.ui.testDetail.expectLifecycleControlOffered(row.state);
          const viewerPage = await steps.openRoleTestDetail({ browser, role: 'viewer', use: testInfo.project.use });
          await viewerPage.open({
            projectSlug: member.arena.project.slug,
            testId: seed.id,
            workspaceId: member.arena.workspaceId,
          });
          await viewerPage.expectNoWriteControls(row.state);
          await viewer.tests.refuseWriteByViewer({ testId: seed.id, row });

          const [, after] = await member.api.tests.getTest(seed.id);
          expect(after.test.title).toBe(seed.title);
          expect(after.test.version).toBe(seed.version);
          expect(after.test.archived_at).toBe(seed.archived_at);
          expect(await newEventIds({ session: member, testId: seed.id, actions: writeActions, before: eventsBefore })).toEqual([]);
        },
      );
    }
  });

  test.describe('BK-2164: non-member sees nothing', () => {
    let foreign: TestLifecycleSession;
    let viewer: ApiFixture;

    test.beforeAll(async () => {
      foreign = await steps.openForeignArena();
      viewer = await steps.openRoleSession({ role: 'viewer' });
    });

    for (const row of NON_MEMBER_ROWS) {
      test(
        `BK-2164: should answer 404 and hide ${row.label} from search for a workspace non-member, the same as for a missing Test`,
        { tag: ['@critical', '@regression'] },
        async () => {
          const seed = await seeds.seedInState({ api: foreign.api, arena: foreign.arena, state: row.state });
          const [, ownerSearch] = await foreign.api.tests.searchTests({ title: seed.title, projectId: foreign.arena.project.id });
          expect(
            ownerSearch.items.some(item => item.id === seed.id),
            'the owner side project search finds a live Test and hides an archived one',
          ).toBe(row.ownerFinds);
          const [, ownerPalette] = await foreign.api.search.searchPalette(seed.title);
          expect(
            ownerPalette.data.some(item => item.id === seed.id),
            'the owner side palette finds a live Test and hides an archived one',
          ).toBe(row.ownerFinds);

          await viewer.tests.hideTestFromNonMember({
            testId: seed.id,
            title: seed.title,
            projectId: foreign.arena.project.id,
            row,
          });
          const [, viewerPalette] = await viewer.search.searchPalette(seed.title);
          expect(viewerPalette.data, 'the palette searched a workspace the viewer cannot see').toEqual([]);
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
        const eventsBefore = await eventIds({ session: member, testId: seed.id, actions: writeActions });

        await member.api.tests.refuseStaleVersionRename({ testId: seed.id, staleVersion: seed.version, currentVersion: before.test.version });

        const [, after] = await member.api.tests.getTest(seed.id);
        expect(after.test.title).toBe(seed.title);
        expect(after.test.version).toBe(before.test.version);
        expect(await newEventIds({ session: member, testId: seed.id, actions: writeActions, before: eventsBefore })).toEqual([]);
      },
    );
  });
});
