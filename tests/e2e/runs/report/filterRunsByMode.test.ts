import type { FixtureProject } from '@data/types';
import type { OwnerSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Mode filter presets', () => {
  let steps: RunFixtureSteps;
  let session: OwnerSession;
  let project: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession();
    project = await steps.discoverProject({ api: session.owner, workspaceId: session.workspaceId, slug: RUN_FIXTURES.main.slug });
    await steps.assertComposition({ api: session.reader, project, recipe: RUN_FIXTURES.main.recipe });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  const rows = [
    { mode: 'manual', expectedRows: 11, scopeLabel: '11 runs in current scope' },
    { mode: 'automated', expectedRows: 50, scopeLabel: '50 runs loaded in current scope · more available' },
  ] as const;

  for (const { mode, expectedRows, scopeLabel } of rows) {
    test(
      `BK-1963: should list only the preset's runs with matching badges and send the preset's executor params when Mode is ${mode} given finished human, agent and ci runs`,
      { tag: ['@high', '@regression'] },
      async ({ test: kata }) => {
        await kata.ui.runsReport.goto({ slug: project.slug });
        expect(await kata.ui.runsReport.countRows()).toBe(50);
        expect(await kata.ui.runsReport.readScopeLabel()).toBe('50 runs loaded in current scope · more available');

        await kata.ui.runsReport.filterRunsByMode({ mode, expectedRows });

        expect(await kata.ui.runsReport.readScopeLabel()).toBe(scopeLabel);
      },
    );
  }
});
