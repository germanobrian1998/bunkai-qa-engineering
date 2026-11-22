import type { FixtureProject } from '@data/types';
import type { RunReportPage } from '@schemas/runs.types';
import type { ErrorEnvelope } from '@schemas/workspace.types';
import type { MemberSession, OwnerSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Report is isolated to its project', () => {
  let steps: RunFixtureSteps;
  let session: OwnerSession;
  let member: MemberSession;
  let projectA: FixtureProject;
  let sibling: FixtureProject;
  let foreign: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession();
    member = await steps.openMemberSession(session);
    projectA = await steps.discoverProject({ api: session.owner, workspaceId: session.workspaceId, slug: RUN_FIXTURES.manualOnly.slug });
    sibling = await steps.discoverProject({ api: session.owner, workspaceId: session.workspaceId, slug: RUN_FIXTURES.main.slug });
    foreign = await steps.discoverProject({ api: member.api, workspaceId: member.ownWorkspaceId, slug: RUN_FIXTURES.automatedOnly.slug });
    await steps.assertComposition({ api: session.reader, project: projectA, recipe: RUN_FIXTURES.manualOnly.recipe });
    await steps.assertComposition({ api: session.reader, project: sibling, recipe: RUN_FIXTURES.main.recipe });
    await steps.assertComposition({ api: member.api, project: foreign, recipe: RUN_FIXTURES.automatedOnly.recipe });
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
      const [, siblingReport] = await session.reader.runs.getReport({ projectId: sibling.id });
      const idsSibling = siblingReport.items.map(item => item.id);
      expect(idsA.filter(id => idsSibling.includes(id))).toEqual([]);

      await kata.ui.runsReport.goto({ slug: projectA.slug });
      expect(await kata.ui.runsReport.readTotals()).toEqual({ passed: 4, failed: 3, manual: 5, automated: 2 });
      expect((await kata.ui.runsReport.listRowIds()).sort()).toEqual([...idsA].sort());
    },
  );

  test(
    'BK-1974: should answer 404 identical to a missing project when the report is read for a project of another workspace',
    { tag: ['@critical', '@regression'] },
    async () => {
      const [, body] = await session.owner.runs.readReportIsolatedToProject({
        projectId: foreign.id,
        expected: { status: 404 },
      });
      const [missingResponse, missingBody] = await session.owner.runs.getReport({ projectId: crypto.randomUUID() });
      const missing = missingBody as unknown as ErrorEnvelope;

      expect(missingResponse.status()).toBe(404);
      const { code, message, details } = (body as ErrorEnvelope).error;
      expect({ code, message, details }).toEqual({ code: missing.error.code, message: missing.error.message, details: missing.error.details });
    },
  );
});
