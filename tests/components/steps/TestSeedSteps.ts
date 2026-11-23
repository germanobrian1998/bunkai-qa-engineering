import type { ApiFixture } from '@ApiFixture';

import type { SeededTest, TestLifecycleArena } from '@data/types';
import { DataFactory } from '@DataFactory';
import { TestContext } from '@TestContext';

interface CreatedTest {
  api: ApiFixture
  id: string
}

export class TestSeedSteps extends TestContext {
  private readonly created: CreatedTest[] = [];
  private readonly watchers: { api: ApiFixture, workspaceId: string }[] = [];

  constructor() {
    super();
  }

  async seedTest(args: { api: ApiFixture, arena: TestLifecycleArena, atcs: number }): Promise<SeededTest> {
    const { api, arena } = args;
    const [, moduleBody] = await api.structure.createModule({
      projectId: arena.project.id,
      name: DataFactory.createModuleName(),
    });
    const [, storyBody] = await api.structure.createUserStory({
      moduleId: moduleBody.module.id,
      title: DataFactory.createStoryTitle(),
    });
    const [, criterionBody] = await api.structure.createAcceptanceCriterion({
      userStoryId: storyBody.user_story.id,
      title: DataFactory.createCriterionTitle(),
    });

    const atcIds: string[] = [];
    for (let index = 0; index < args.atcs; index++) {
      const [, atcBody] = await api.atcs.createAtc(DataFactory.createAtcPayload({
        moduleId: moduleBody.module.id,
        userStoryId: storyBody.user_story.id,
        acceptanceCriterionIds: [criterionBody.acceptance_criterion.id],
      }));
      atcIds.push(atcBody.atc.id);
    }

    const title = DataFactory.createTestTitle();
    const [, created] = await api.tests.createTest({ title, atcIds, workspaceId: arena.workspaceId });
    this.adopt({ api, testId: created.test.id });
    const [, read] = await api.tests.getTest(created.test.id);
    return { id: read.test.id, title: read.test.title, version: read.test.version, atcIds };
  }

  private adopt(args: { api: ApiFixture, testId: string }): void {
    this.created.push({ api: args.api, id: args.testId });
  }

  watchCreates(args: { api: ApiFixture, workspaceId: string }): void {
    this.watchers.push(args);
  }

  private async sweepAttemptedCreates(): Promise<void> {
    for (const watcher of this.watchers) {
      for (const title of new Set(watcher.api.tests.attemptedCreateTitles)) {
        const [, events] = await watcher.api.activity.listTestEvents({
          workspaceId: watcher.workspaceId,
          action: 'test.created',
          title,
        });
        for (const event of events) {
          if (event.item.entity_id !== null) {
            this.adopt({ api: watcher.api, testId: event.item.entity_id });
          }
        }
      }
    }
  }

  async teardown(): Promise<void> {
    await this.sweepAttemptedCreates();
    const errors: unknown[] = [];
    const failedIds: string[] = [];
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
      throw new AggregateError(errors, `teardown failed: could not archive Test ids [${failedIds.join(', ')}]`);
    }
  }
}
