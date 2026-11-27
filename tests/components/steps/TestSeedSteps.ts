import type { ApiFixture } from '@ApiFixture';

import type { SeededTest, TestLifecycleArena } from '@data/types';
import { PLAN_TEARDOWN, TEST_LIFECYCLE_FIXTURE } from '@data/constants';
import { DataFactory } from '@DataFactory';
import { TestContext } from '@TestContext';

interface CreatedTest {
  api: ApiFixture
  id: string
}

interface CreatedPlan {
  api: ApiFixture
  id: string
}

export class TestSeedSteps extends TestContext {
  private readonly created: CreatedTest[] = [];
  private readonly createdPlans: CreatedPlan[] = [];
  private readonly environments = new Map<string, string>();

  constructor() {
    super();
  }

  async seedTest(args: { api: ApiFixture, arena: TestLifecycleArena, chainLength?: number }): Promise<SeededTest> {
    const { api, arena, chainLength = 1 } = args;
    const [, created] = await api.tests.createTest({
      title: DataFactory.createTestTitle(),
      atcIds: Array.from({ length: chainLength }).map(() => arena.atcId),
      workspaceId: arena.workspaceId,
    });
    this.adopt({ api, testId: created.test.id });
    const [, read] = await api.tests.getTest(created.test.id);
    return read.test;
  }

  async seedInState(args: {
    api: ApiFixture
    arena: TestLifecycleArena
    state: 'live' | 'archived'
    chainLength?: number
    tags?: string[]
  }): Promise<SeededTest> {
    const { api, arena, state, chainLength, tags } = args;
    const seed = await this.seedTest({ api, arena, chainLength });
    if (!tags && state === 'live') {
      return seed;
    }
    if (tags) {
      await api.tests.setTags({ testId: seed.id, tags });
    }
    if (state === 'archived') {
      await api.tests.archiveTest(seed.id);
    }
    const [, read] = await api.tests.getTest(seed.id);
    return read.test;
  }

  private async ensureEnvironment(args: { api: ApiFixture, projectId: string }): Promise<string> {
    const cached = this.environments.get(args.projectId);
    if (cached) {
      return cached;
    }
    const [, listed] = await args.api.structure.listEnvironments(args.projectId);
    const found = listed.environments.find(environment => environment.name === TEST_LIFECYCLE_FIXTURE.environmentName);
    const environmentId = found
      ? found.id
      : (await args.api.structure.createEnvironment({ projectId: args.projectId, name: TEST_LIFECYCLE_FIXTURE.environmentName }))[1].environment.id;
    this.environments.set(args.projectId, environmentId);
    return environmentId;
  }

  private async finishPassedRun(args: { api: ApiFixture, testId: string, environmentId: string }): Promise<void> {
    const { api, testId, environmentId } = args;
    const [, started] = await api.runs.startRun({ testId, environmentId });
    for (const atc of started.run.atcs) {
      for (const runStep of atc.steps) {
        await api.runs.markStep({ runId: started.run.id, stepId: runStep.id, status: 'passed' });
      }
    }
    await api.runs.finishRun({ runId: started.run.id, verdict: 'passed' });
  }

  async seedWithHistory(args: {
    api: ApiFixture
    arena: TestLifecycleArena
    chainLength: number
    tags: string[]
    finishedRuns: number
    plans: number
  }): Promise<SeededTest> {
    const { api, arena, chainLength, tags, finishedRuns, plans } = args;
    const seed = await this.seedInState({ api, arena, state: 'live', chainLength, tags });
    const environmentId = await this.ensureEnvironment({ api, projectId: arena.project.id });
    for (let run = 0; run < finishedRuns; run++) {
      await this.finishPassedRun({ api, testId: seed.id, environmentId });
    }
    for (let plan = 0; plan < plans; plan++) {
      const [, created] = await api.plans.createPlan({ projectId: arena.project.id, name: DataFactory.createPlanName() });
      this.createdPlans.push({ api, id: created.test_plan.id });
      await api.plans.addTests({ planId: created.test_plan.id, testIds: [seed.id] });
    }
    const [, read] = await api.tests.getTest(seed.id);
    return read.test;
  }

  adopt(args: { api: ApiFixture, testId: string }): void {
    this.created.push({ api: args.api, id: args.testId });
  }

  async teardown(): Promise<void> {
    const errors: unknown[] = [];
    const failedIds: string[] = [];
    const failedPlanIds: string[] = [];
    for (const plan of this.createdPlans) {
      try {
        await plan.api.plans.closePlan({ planId: plan.id, verdict: PLAN_TEARDOWN.verdict, summary: PLAN_TEARDOWN.summary });
      }
      catch (error) {
        failedPlanIds.push(plan.id);
        errors.push(error);
      }
    }
    for (const test of this.created) {
      try {
        await test.api.tests.archiveTest(test.id);
      }
      catch (error) {
        failedIds.push(test.id);
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, `teardown failed: could not archive Test ids [${failedIds.join(', ')}] or close plan ids [${failedPlanIds.join(', ')}]`);
    }
  }
}
