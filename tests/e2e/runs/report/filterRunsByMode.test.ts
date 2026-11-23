import type { FixtureProject } from '@data/types';
import type { ReaderSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Mode filter presets', () => {
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

  const rows = [
    { mode: 'manual', expectedRows: 11, scopeLabel: /^11 runs in current scope$/, totals: { passed: 7, failed: 3, manual: 10, automated: 0 } },
    { mode: 'automated', expectedRows: 50, scopeLabel: /^50 runs loaded in current scope\s*·\s*more available$/, totals: { passed: 40, failed: 11, manual: 0, automated: 51 } },
  ] as const;

  for (const { mode, expectedRows, scopeLabel, totals } of rows) {
    test(
      `BK-1963: should list only the preset's runs with matching badges and send the preset's executor params when Mode is ${mode} given finished human, agent and ci runs`,
      { tag: ['@high', '@regression'] },
      async ({ test: kata }) => {
        await kata.ui.runsReport.goto({ slug: project.slug, workspaceId: project.workspaceId });
        await expect(kata.ui.runsReport.rowsLocator()).toHaveCount(50);
        expect(await kata.ui.runsReport.readScopeLabel()).toMatch(/^50 runs loaded in current scope\s*·\s*more available$/);

        await kata.ui.runsReport.filterRunsByMode({ mode, expectedRows });

        expect(await kata.ui.runsReport.readScopeLabel()).toMatch(scopeLabel);
        expect(await kata.ui.runsReport.readTotals()).toEqual(totals);
      },
    );
  }
});
