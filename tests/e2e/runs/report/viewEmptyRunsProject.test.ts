import type { FixtureProject } from '@data/types';
import type { MemberSession, OwnerSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { config, expect, test } from '@TestFixture';

test.use({ storageState: config.auth.roleStatePath('member') });

test.describe('BK-225: First-use state wins over Mode', () => {
  let steps: RunFixtureSteps;
  let member: MemberSession;
  let project: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    const owner: OwnerSession = await steps.openOwnerSession();
    member = await steps.openMemberSession(owner);
    project = await steps.discoverProject({ api: member.api, workspaceId: member.ownWorkspaceId, slug: RUN_FIXTURES.empty.slug });
    await steps.assertComposition({ api: member.api, project, recipe: RUN_FIXTURES.empty.recipe });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  for (const mode of ['all', 'automated', 'manual'] as const) {
    test(
      `BK-1992: should show the first-use state when Mode is ${mode} given a project with no runs`,
      { tag: ['@medium', '@regression'] },
      async ({ test: kata }) => {
        await kata.ui.runsReport.openEmptyProjectUnderMode({ slug: project.slug, workspaceId: project.workspaceId, mode });

        expect(await kata.ui.runsReport.readTotals()).toEqual({ passed: 0, failed: 0, manual: 0, automated: 0 });
        const [, report] = await member.api.runs.getReport({ projectId: project.id });
        expect(report.scope).toEqual({ has_runs: false, has_automated: false });
      },
    );
  }
});
