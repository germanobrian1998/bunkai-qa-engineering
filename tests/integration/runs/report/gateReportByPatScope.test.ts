import type { ApiFixture } from '@ApiFixture';
import type { FixtureProject } from '@data/types';
import type { RunReportPage } from '@schemas/runs.types';
import type { ReaderSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Report endpoint PAT scope gate', () => {
  let steps: RunFixtureSteps;
  let session: ReaderSession;
  let project: FixtureProject;
  let writerApi: ApiFixture;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession({ reader: true });
    project = await steps.discoverProject({ api: session.owner, role: 'owner', workspaceId: session.workspaceId, slug: RUN_FIXTURES.main.slug });
    await steps.assertComposition({ api: session.reader, role: 'owner PAT atc:read', project, recipe: RUN_FIXTURES.main.recipe });
    writerApi = await steps.mintBearer({ owner: session.owner, workspaceId: session.workspaceId, scopes: ['run:execute'] });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  const rows = [
    {
      hasAtcRead: false,
      status: 403,
      token: 'without atc:read',
      verify: (_body: unknown) => {},
    },
    {
      hasAtcRead: true,
      status: 200,
      token: 'with atc:read',
      verify: (body: unknown) => {
        const page = body as RunReportPage;
        expect(page.totals).toEqual({ passed: 20, failed: 6, manual: 0, automated: 26 });
        expect(page.scope).toEqual({ has_runs: true, has_automated: true });
      },
    },
  ];

  for (const { hasAtcRead, status, token, verify } of rows) {
    test(
      `BK-1982: should answer ${status} when the report endpoint is called with a PAT ${token} given a readable project`,
      { tag: ['@medium', '@regression'] },
      async () => {
        const caller = hasAtcRead ? session.reader : writerApi;

        const [, body] = await caller.runs.readReportWithScopedToken({ projectId: project.id, hasAtcRead });

        verify(body);
      },
    );
  }
});
