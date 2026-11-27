import type { PlanFiguresScope, RunReadsScope } from '@data/types';
import type { PlanMemberTestsResponse } from '@schemas/tests.types';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { DataFactory } from '@DataFactory';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

const FINISHED_RUNS = 2;

function membershipsOf(response: PlanMemberTestsResponse): { id: string, added_at: string, added_by: string | null }[] {
  return response.tests
    .map(row => ({ id: row.id, added_at: row.added_at, added_by: row.added_by }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

test.describe('BK-596: Archive keeps past numbers', () => {
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
    'BK-2178: should keep the runs report, the workspace runs index and the run comparison identical after archiving a Test given a Test with finished Runs',
    { tag: ['@critical', '@regression'] },
    async () => {
      const isolated = await seeds.seedIsolatedModule({ api: member.api, arena: member.arena });
      const seed = await seeds.seedWithHistory({
        api: member.api,
        arena: isolated.arena,
        chainLength: 1,
        tags: [DataFactory.createTag()],
        finishedRuns: FINISHED_RUNS,
        plans: 0,
      });
      const [, history] = await member.api.tests.listRunHistory(seed.id);
      const runIds = history.map(run => run.id).sort();
      expect(runIds, 'precondition: the Test has 2 finished Runs').toHaveLength(FINISHED_RUNS);
      const scope: RunReadsScope = {
        workspaceId: member.arena.workspaceId,
        projectId: member.arena.project.id,
        moduleId: isolated.moduleId,
        testId: seed.id,
        runId: history[0].id,
      };
      const baseline = await member.api.runs.captureRunReads(scope);
      expect(baseline.report.items.map(item => item.id).sort(), 'precondition: the report of the Test module lists exactly its Runs').toEqual(runIds);
      expect(baseline.report.totals.passed, 'precondition: the report counts both passed Runs').toBe(FINISHED_RUNS);
      expect(baseline.workspaceRuns.map(row => row.id).sort(), 'precondition: the workspace index lists exactly the Runs of the Test').toEqual(runIds);
      expect(baseline.compare.state, 'precondition: the latest Run has a previous Run to compare with').toBe('compared');

      await member.api.tests.archiveTest(seed.id);

      await member.api.runs.holdRunReadsAfterArchive({ baseline, scope });
    },
  );

  test(
    'BK-2179: should keep open plan progress, milestone readiness and a closed plan snapshot identical after archiving a Test given a Test held by open and closed plans',
    { tag: ['@critical', '@regression'] },
    async ({ test: kata }) => {
      const tested = await seeds.seedWithHistory({
        api: member.api,
        arena: member.arena,
        chainLength: 1,
        tags: [DataFactory.createTag()],
        finishedRuns: 1,
        plans: 0,
      });
      const neverRun = await seeds.seedTest({ api: member.api, arena: member.arena });
      const planSeed = await seeds.seedPlanFigures({ api: member.api, arena: member.arena, testIds: [tested.id, neverRun.id] });
      const scope: PlanFiguresScope = {
        projectSlug: member.arena.project.slug,
        workspaceId: member.arena.workspaceId,
        ...planSeed,
      };
      const baseline = await kata.ui.planFigures.readFigures(scope);
      expect(baseline.openPlan.percent, 'precondition: 1 passed Test of 2 members gives 50 percent on the open plan').toBe('50%');
      expect(baseline.openPlan.passedLabel, 'precondition: the open plan counts both members').toContain('1 of 2');
      expect(baseline.openPlan.note, 'precondition: the open plan figures are live').toContain('Computed');
      expect(baseline.milestone.percent, 'precondition: the milestone pools the open plan').toBe('50%');
      expect(baseline.closedPlan.percent, 'precondition: the plan closed with both members froze at 50 percent').toBe('50%');
      expect(baseline.closedPlan.note, 'precondition: the closed plan shows its frozen figures').toContain('Frozen');
      const openMembersBefore = membershipsOf((await member.api.plans.listPlanTests(scope.openPlanId))[1]);
      const closedMembersBefore = membershipsOf((await member.api.plans.listPlanTests(scope.closedPlanId))[1]);
      expect(openMembersBefore.map(row => row.id).sort(), 'precondition: the open plan holds both Tests').toEqual([tested.id, neverRun.id].sort());
      expect(closedMembersBefore.map(row => row.id).sort(), 'precondition: the closed plan holds both Tests').toEqual([tested.id, neverRun.id].sort());

      await member.api.tests.archiveTest(tested.id);

      await kata.ui.planFigures.expectFiguresUnchangedAfterArchive({ baseline, scope });
      const openMembersAfter = membershipsOf((await member.api.plans.listPlanTests(scope.openPlanId))[1]);
      const closedMembersAfter = membershipsOf((await member.api.plans.listPlanTests(scope.closedPlanId))[1]);
      expect(openMembersAfter, 'archiving adds no membership row to and removes none from the open plan, with the same added_at and added_by').toEqual(openMembersBefore);
      expect(closedMembersAfter, 'archiving adds no membership row to and removes none from the closed plan, with the same added_at and added_by').toEqual(closedMembersBefore);
    },
  );
});
