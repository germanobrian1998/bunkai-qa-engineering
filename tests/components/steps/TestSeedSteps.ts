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
    return { id: read.test.id, title: read.test.title, version: read.test.version };
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
    if (tags) {
      await api.tests.setTags({ testId: seed.id, tags });
    }
    if (state === 'archived') {
      await api.tests.archiveTest(seed.id);
    }
    const [, read] = await api.tests.getTest(seed.id);
    return { id: read.test.id, title: read.test.title, version: read.test.version };
  }

  adopt(args: { api: ApiFixture, testId: string }): void {
    this.created.push({ api: args.api, id: args.testId });
  }

  async teardown(): Promise<void> {
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
