import type { FixtureProject } from '@data/types';
import type { ErrorEnvelope } from '@schemas/workspace.types';
import type { MemberSession, ReaderSession } from '@steps/RunFixtureSteps';
import { RUN_FIXTURES } from '@data/constants';
import { RunFixtureSteps } from '@steps/RunFixtureSteps';
import { expect, test } from '@TestFixture';

test.describe('BK-225: Report answers 404 for a project of another workspace', () => {
  let steps: RunFixtureSteps;
  let session: ReaderSession;
  let member: MemberSession;
  let foreign: FixtureProject;

  test.beforeAll(async ({ playwright }) => {
    steps = new RunFixtureSteps({ playwright });
    session = await steps.openOwnerSession({ reader: true });
    member = await steps.openMemberSession(session);
    foreign = await steps.discoverProject({ api: member.api, role: 'member', workspaceId: member.ownWorkspaceId, slug: RUN_FIXTURES.automatedOnly.slug });
    await steps.assertComposition({ api: member.api, role: 'member', project: foreign, recipe: RUN_FIXTURES.automatedOnly.recipe });
  });

  test.afterAll(async () => {
    await steps?.teardown();
  });

  test(
    'BK-1974: should answer 404 identical to a missing project when the report is read for a project of another workspace',
    { tag: ['@critical', '@regression'] },
    async () => {
      for (const caller of [session.owner, session.reader]) {
        const [, body] = await caller.runs.readReportIsolatedToProject({
          projectId: foreign.id,
          expected: { status: 404 },
        });
        const [missingResponse, missing] = await caller.runs.getReportError({ projectId: crypto.randomUUID() });

        expect(missingResponse.status()).toBe(404);
        const { code, message, details } = (body as ErrorEnvelope).error;
        expect({ code, message, details }).toEqual({ code: missing.error.code, message: missing.error.message, details: missing.error.details });
      }
    },
  );
});
