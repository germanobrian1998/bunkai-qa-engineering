import type { FixtureProject } from '@data/types';
import type { ReaderSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Mode survives the 50-row page boundary', () => {
  let steps: RunFixtureSteps;
  let session: ReaderSession;
  let project: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession({ reader: true });
    project = await steps.discoverProject({ api: session.owner, role: 'owner', workspaceId: session.workspaceId, slug: RUN_FIXTURES.main.slug });
    await steps.assertComposition({ api: session.reader, role: 'owner PAT atc:read', project, recipe: RUN_FIXTURES.main.recipe });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  test(
    'BK-1967: should show per-mode totals before page 2 and keep Mode Automated applied on both pages when older runs are loaded given a project with 51 automated and 10 manual runs',
    { tag: ['@medium', '@regression'] },
    async ({ test: kata }) => {
      await kata.ui.runsReport.goto({ slug: project.slug, workspaceId: project.workspaceId });
      expect(await kata.ui.runsReport.readTotals()).toEqual({ passed: 47, failed: 14, manual: 10, automated: 51 });

      await kata.ui.runsReport.loadOlderRunsUnderMode({
        mode: 'automated',
        expected: { manual: 0, automated: 51, pageOneRows: 50, rowsAfterPageTwo: 53 },
      });

      const uiTotals = await kata.ui.runsReport.readTotals();
      const [reportResponse, report] = await session.reader.runs.getReport({ projectId: project.id, query: { executor: ['agent', 'ci'] } });
      expect(reportResponse.status(), 'oracle: GET runs/report?executor=agent,ci as owner PAT atc:read').toBe(200);
      expect(uiTotals).toEqual(report.totals);
      expect(uiTotals).toEqual({ passed: 40, failed: 11, manual: 0, automated: 51 });
    },
  );
});
