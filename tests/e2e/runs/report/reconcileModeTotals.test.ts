import type { FixtureProject } from '@data/types';
import type { RunReportTotals } from '@schemas/runs.types';
import type { ReaderSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

const NO_RUNNING_REASON = 'no fixture holds a running run, and one cannot be built without mutating a fixture (ADR-0029)';
const NO_LEGACY_REASON = 'no pre-feature run is reachable by the Owner: no API marker tells a pre-feature run apart (ADR-0029)';

test.describe('BK-225: Manual plus Automated equals Passed plus Failed', () => {
  let steps: RunFixtureSteps;
  let session: ReaderSession;
  let project: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession({ reader: true });
    project = await steps.discoverProject({ api: session.owner, role: 'owner', workspaceId: session.workspaceId, slug: RUN_FIXTURES.manualOnly.slug });
    await steps.assertComposition({ api: session.reader, role: 'owner PAT atc:read', project, recipe: RUN_FIXTURES.manualOnly.recipe });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  const rows: {
    filters: string
    query: Record<string, string[]>
    status: ('passed' | 'failed' | 'aborted')[]
    mode: 'all' | 'automated'
    totals: RunReportTotals
    rows: number
    listed: string[]
  }[] = [
    {
      filters: 'no filter',
      query: {},
      status: [],
      mode: 'all',
      totals: { passed: 4, failed: 3, manual: 5, automated: 2 },
      rows: 12,
      listed: ['aborted', 'failed', 'passed'],
    },
    {
      filters: 'Status Failed',
      query: { status: ['failed'] },
      status: ['failed'],
      mode: 'all',
      totals: { passed: 0, failed: 3, manual: 2, automated: 1 },
      rows: 3,
      listed: ['failed'],
    },
    {
      filters: 'Status Failed and Mode Automated',
      query: { status: ['failed'], executor: ['agent', 'ci'] },
      status: ['failed'],
      mode: 'automated',
      totals: { passed: 0, failed: 1, manual: 0, automated: 1 },
      rows: 1,
      listed: ['failed'],
    },
    {
      filters: 'Status Aborted',
      query: { status: ['aborted'] },
      status: ['aborted'],
      mode: 'all',
      totals: { passed: 0, failed: 0, manual: 0, automated: 0 },
      rows: 5,
      listed: ['aborted'],
    },
  ];

  for (const row of rows) {
    test(
      `BK-1975: should keep Manual plus Automated equal to Passed plus Failed across API totals, UI chips and the fixture recipe when ${row.filters} is applied`,
      { tag: ['@critical', '@regression'] },
      async ({ test: kata }) => {
        const [, body] = await session.reader.runs.readReportWithConsistentTotals({
          projectId: project.id,
          query: row.query,
        });
        expect(body.totals).toEqual(row.totals);
        expect(body.items).toHaveLength(row.rows);
        expect([...new Set(body.items.map(item => item.status))].sort()).toEqual(row.listed);

        await kata.ui.runsReport.goto({ slug: project.slug, workspaceId: project.workspaceId });
        for (const status of row.status) {
          await kata.ui.runsReport.applyStatus(status);
        }
        if (row.mode === 'automated') {
          await kata.ui.runsReport.applyMode('automated');
        }
        expect(await kata.ui.runsReport.readTotals()).toEqual(row.totals);
        await expect(kata.ui.runsReport.rowsLocator()).toHaveCount(row.rows);
        await expect(kata.ui.runsReport.totalChips()).toHaveCount(4);
        await expect(kata.ui.runsReport.totalsRegion()).not.toContainText(/Aborted/);
      },
    );
  }

  test(
    'BK-1975: should not count a running run in any total when the report totals are read given a project with a running run',
    { tag: ['@critical', '@regression'] },
    async () => {
      // eslint-disable-next-line playwright/no-skipped-test -- fixture gap recorded in ADR-0029: no frozen project holds a running run
      test.skip(true, NO_RUNNING_REASON);
    },
  );

  test(
    'BK-1975: should badge a run created before the feature with its stored executor when the run is listed given a pre-feature run',
    { tag: ['@critical', '@regression'] },
    async () => {
      // eslint-disable-next-line playwright/no-skipped-test -- fixture gap recorded in ADR-0029: no reachable pre-feature run
      test.skip(true, NO_LEGACY_REASON);
    },
  );
});
