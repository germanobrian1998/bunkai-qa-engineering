import type { PlanFiguresScope, RunReadsScope } from '@data/types';
import type { TestLifecycleSession } from '@steps/TestLifecycleSteps';

import { DataFactory } from '@DataFactory';
import { TestLifecycleSteps } from '@steps/TestLifecycleSteps';
import { TestSeedSteps } from '@steps/TestSeedSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.use({ storageState: config.auth.roleStatePath('member') });

const FINISHED_RUNS = 2;

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
        testCreatedAt: seed.created_at,
        runId: history[0].id,
      };
      const baseline = await member.api.runs.captureRunReads(scope);
      expect(baseline.report.items.map(item => item.id).sort(), 'precondition: the report of the Test module lists exactly its Runs').toEqual(runIds);
      expect(baseline.report.totals.passed, 'precondition: the report counts both passed Runs').toBe(FINISHED_RUNS);
      expect(baseline.report.scope.has_runs, 'precondition: the project report scope flags the project as having Runs').toBe(true);
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
      test.slow();
      const planSeed = await seeds.seedPlanFigures({ api: member.api, arena: member.arena });
      const members = [planSeed.passedTestId, planSeed.idleTestId].sort();
      const scope: PlanFiguresScope = {
        projectSlug: member.arena.project.slug,
        workspaceId: member.arena.workspaceId,
        openPlanId: planSeed.openPlanId,
        closedPlanId: planSeed.closedPlanId,
        milestoneId: planSeed.milestoneId,
      };
      const baseline = await kata.ui.planFigures.readFigures(scope);
      expect(baseline.openPlan.percent, 'precondition: 1 passed Test of 2 members gives 50 percent on the open plan').toBe('50%');
      expect(baseline.openPlan.passedLabel, 'precondition: the open plan counts 1 passed of 2 members').toContain('1 of 2');
      expect(baseline.openPlan.chips, 'precondition: the open plan splits its members into 1 passed and 1 not run').toEqual(['Passed1', 'Failed0', 'Aborted0', 'In progress0', 'Not run1']);
      expect(baseline.openPlan.note, 'precondition: the open plan figures are live').toContain('Computed');
      expect(baseline.milestone.percent, 'precondition: the milestone pools the open plan').toBe('50%');
      expect(baseline.closedPlan.percent, 'precondition: the plan closed before any Run finished froze at 0 percent').toBe('0%');
      expect(baseline.closedPlan.passedLabel, 'precondition: the closed plan froze 0 passed of 2 members').toContain('0 of 2');
      expect(baseline.closedPlan.note, 'precondition: the closed plan shows its frozen figures').toContain('Frozen');
      const openMembersBefore = await member.api.plans.listPlanMemberships(scope.openPlanId);
      const closedMembersBefore = await member.api.plans.listPlanMemberships(scope.closedPlanId);
      expect(openMembersBefore.map(row => row.id), 'precondition: the open plan holds both Tests').toEqual(members);
      expect(closedMembersBefore.map(row => row.id), 'precondition: the closed plan holds both Tests').toEqual(members);

      await member.api.tests.archiveTest(planSeed.passedTestId);

      await kata.ui.planFigures.expectFiguresUnchangedAfterArchive({ baseline, scope });
      const openMembersAfter = await member.api.plans.listPlanMemberships(scope.openPlanId);
      const closedMembersAfter = await member.api.plans.listPlanMemberships(scope.closedPlanId);
      expect(openMembersAfter, 'archiving adds no membership row to and removes none from the open plan, with the same added_at and added_by').toEqual(openMembersBefore);
      expect(closedMembersAfter, 'archiving adds no membership row to and removes none from the closed plan, with the same added_at and added_by').toEqual(closedMembersBefore);
    },
  );
});
