import type { FixtureProject } from '@data/types';
import type { RunReportPage } from '@schemas/runs.types';
import type { ReaderSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Report endpoint parameter validation', () => {
  let steps: RunFixtureSteps;
  let session: ReaderSession;
  let boundary: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession({ reader: true });
    boundary = await steps.discoverProject({ api: session.owner, role: 'owner', workspaceId: session.workspaceId, slug: RUN_FIXTURES.main.slug });
    await steps.assertComposition({ api: session.reader, role: 'owner PAT atc:read', project: boundary, recipe: RUN_FIXTURES.main.recipe });
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
      expected: { status: 200, items: 27, nextCursor: false },
      verify: async (body) => {
        const page = body as RunReportPage;
        expect(page.totals).toEqual({ passed: 20, failed: 6, manual: 0, automated: 26 });
        const [singleResponse, single] = await session.reader.runs.getReport({ projectId: boundary.id, query: { executor: ['agent'] } });
        expect(singleResponse.status(), 'oracle: GET runs/report?executor=agent as owner PAT atc:read').toBe(200);
        expect(page.items.map(item => item.id)).toEqual(single.items.map(item => item.id));
      },
    },
    {
      query: 'mode=automated',
      expected: { status: 200, items: 50, nextCursor: true },
      verify: async (body) => {
        const page = body as RunReportPage;
        expect(page.totals).toEqual({ passed: 47, failed: 14, manual: 10, automated: 51 });
      },
    },
    { query: 'date_from=2026-07-31&date_to=2026-07-01', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'date_from=2026-02-30', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'date_to=2026-13-45', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'limit=51', expected: { status: 422 }, verify: noExtraCheck },
    { query: 'limit=0', expected: { status: 422 }, verify: noExtraCheck },
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
