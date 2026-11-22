import type { FixtureProject } from '@data/types';
import type { RunReportPage } from '@schemas/runs.types';
import type { OwnerSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Report endpoint parameter validation', () => {
  let steps: RunFixtureSteps;
  let session: OwnerSession;
  let boundary: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession();
    boundary = await steps.discoverProject({ api: session.owner, workspaceId: session.workspaceId, slug: RUN_FIXTURES.main.slug });
    await steps.assertComposition({ api: session.reader, project: boundary, recipe: RUN_FIXTURES.main.recipe });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  const noExtraCheck = async (_body: unknown) => {};

  const rows: {
    query: string
    expected: { status: 200 | 400 | 422, items?: number, nextCursor?: boolean }
    verify: (body: unknown) => Promise<void>
  }[] = [
    { query: 'executor=robot', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'status=running', expected: { status: 422 }, verify: noExtraCheck },
    {
      query: 'executor=agent&executor=agent',
      expected: { status: 200 },
      verify: async (body) => {
        const [, single] = await session.reader.runs.getReport({ projectId: boundary.id, query: { executor: ['agent'] } });
        expect((body as RunReportPage).items.map(item => item.id)).toEqual(single.items.map(item => item.id));
      },
    },
    {
      query: 'mode=automated',
      expected: { status: 200, items: 50 },
      verify: async (body) => {
        const { totals } = body as RunReportPage;
        expect(totals.passed + totals.failed).toBe(61);
      },
    },
    { query: 'date_from=2026-07-31&date_to=2026-07-01', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'date_from=2026-02-30', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'date_to=2026-13-45', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'limit=51', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'limit=50', expected: { status: 200, items: 50, nextCursor: true }, verify: noExtraCheck },
    { query: 'cursor=garbage', expected: { status: 400 }, verify: noExtraCheck },
  ];

  for (const { query, expected, verify } of rows) {
    test(
      `BK-1983: should answer ${expected.status} when the report API is called with ${query} given a project with more than 50 runs`,
      { tag: ['@medium', '@regression'] },
      async () => {
        const [, body] = await session.reader.runs.probeReportParameters({ projectId: boundary.id, query, expected });

        await verify(body);
      },
    );
  }
});
