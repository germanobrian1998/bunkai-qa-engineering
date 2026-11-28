# ATC Spec: BK-2158 - Refuse a Run from an archived Test

> Ticket: BK-2158 (TC19)
> Component: RunsApi (tests/components/api/RunsApi.ts), EXISTING manifest entry, extended
> Type: API - Negative
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should offer no Start Run and refuse POST /runs with 409 test_archived given an archived Test | Starting a Run is a use surface and must be refused for an archived Test | Archived never-run Test; a valid environment | AC-03 3.3 |

## 2. ATC Contract
```typescript
@atc('BK-2158')
async refuseRunFromArchivedTest(args: { testId: string, environmentId: string }): Promise<[APIResponse, ErrorEnvelope]> {
  const [response, body] = await this.apiPOST<ErrorEnvelope, StartRunBody>(
    '/v1/runs',
    { test_id: args.testId, environment_id: args.environmentId },
    { headers: { 'Idempotency-Key': randomUUID() } },
  );
  expect(response.status(), 'starting a Run from an archived Test is a conflict').toBe(409);
  expect(body.error.code).toBe('conflict');
  expect(this.readReason(body)).toBe(TEST_LIFECYCLE.archivedReason);
  return [response, body];
}
```
`readReason` already exists privately in RunsApi (reuse, do not duplicate).

## 3A. API Details
`POST /api/v1/runs`, body `RunCreateBody` (`test_id`, `environment_id`), Idempotency-Key required, 409 with `details.reason` `test_archived`. Types from `@schemas/tests.types` (`StartRunBody`) and `ErrorEnvelope`.

## 4. Assertions Split
### Fixed (inside ATC)
Status 409, error code `conflict`, reason `test_archived`.
### Test-level (in test file)
Positive control on the live Test (`TestDetailPage.expectStartRunOffered`: `start-run-button` visible, which also proves the project has an environment); after the archive, `TestDetailPage.expectNoStartRun` (archived banner visible first, then no `start-run-button` or `start-run-env`); the workspace runs index has no row for the Test (`RunsApi.readWorkspaceRuns` with `since` the Test creation time, expected `[]`), the API proxy of "no runs row exists". The ATC is called through the `member.api` session, not `kata.api`.

The TC's final "restore so the fixture is live again" step is dropped because each test seeds its own Test; the Test ends archived and is left as residue.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-03 3.3 | EP (single partition: archived Test) | 1 |

The automated-submission twin (`/runs/submissions`) is BK-2159, Deferred. Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedInState({ state: 'live' })`, `TestSeedSteps.ensureEnvironment` (now public), `TestsApi.archiveTest`
- Components: RunsApi (extended), TestDetailPage (`expectStartRunOffered`, `expectNoStartRun`)

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live never-run Test, archived mid-test after the live positive control | Generate | API | test | none, ends archived |

## 9. Checklist
- [ ] refuseRunFromArchivedTest naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (RunsApi has BK-1974, BK-1975, BK-1982, BK-1983 only)
