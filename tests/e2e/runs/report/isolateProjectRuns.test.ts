import type { FixtureProject } from '@data/types';
import type { RunReportPage } from '@schemas/runs.types';
import type { ReaderSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Report is isolated to its project', () => {
  let steps: RunFixtureSteps;
  let session: ReaderSession;
  let projectA: FixtureProject;
  let sibling: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession({ reader: true });
    projectA = await steps.discoverProject({ api: session.owner, role: 'owner', workspaceId: session.workspaceId, slug: RUN_FIXTURES.manualOnly.slug });
    sibling = await steps.discoverProject({ api: session.owner, role: 'owner', workspaceId: session.workspaceId, slug: RUN_FIXTURES.main.slug });
    await steps.assertComposition({ api: session.reader, role: 'owner PAT atc:read', project: projectA, recipe: RUN_FIXTURES.manualOnly.recipe });
    await steps.assertComposition({ api: session.reader, role: 'owner PAT atc:read', project: sibling, recipe: RUN_FIXTURES.main.recipe });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  test(
    'BK-1974: should exclude the sibling project\'s runs from rows and per-mode totals when the report is read for a project of the same workspace',
    { tag: ['@critical', '@regression'] },
    async ({ test: kata }) => {
      const [, body] = await session.reader.runs.readReportIsolatedToProject({
        projectId: projectA.id,
        expected: { status: 200, automated: 2, manual: 5, rows: 12 },
      });
      const idsA = (body as RunReportPage).items.map(item => item.id);
      const idsSibling = await steps.readAllRunIds({ api: session.reader, role: 'owner PAT atc:read', project: sibling });
      expect(idsA.filter(id => idsSibling.includes(id))).toEqual([]);

      await kata.ui.runsReport.goto({ slug: projectA.slug, workspaceId: projectA.workspaceId });
      expect(await kata.ui.runsReport.readTotals()).toEqual({ passed: 4, failed: 3, manual: 5, automated: 2 });
      await kata.ui.runsReport.expectRowsMatchIds(idsA);
    },
  );
});
