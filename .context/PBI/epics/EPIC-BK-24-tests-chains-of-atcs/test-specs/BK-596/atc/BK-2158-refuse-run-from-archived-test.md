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
  const [response, body] = await this.apiPOST<ErrorEnvelope, StartRunPayload>(
    '/v1/runs',
    { test_id: args.testId, environment_id: args.environmentId },
    { headers: { 'Idempotency-Key': randomUUID() } },
  );
  expect(response.status()).toBe(409);
  expect(body.error.code).toBe('conflict');
  expect(this.readReason(body)).toBe(TEST_LIFECYCLE.archiveReason);
  return [response, body];
}
```
`readReason` already exists privately in RunsApi (reuse, do not duplicate).

## 3A. API Details
`POST /api/v1/runs`, body `RunCreateBody` (`test_id`, `environment_id`), Idempotency-Key required, 409 with `details.reason` `test_archived`. Types from `@schemas/tests.types` (`StartRunPayload`) and `ErrorEnvelope`.

## 4. Assertions Split
### Fixed (inside ATC)
Status 409, error code `conflict`, reason `test_archived`.
### Test-level (in test file)
`TestDetailPage.expectNoStartRun` (no `start-run-button`, archived banner shown); the workspace runs index gained no row for the Test (baseline vs after, `RunsApi.readWorkspaceRuns`), the API proxy of "no runs row exists".

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-03 3.3 | EP (single partition: archived Test) | 1 |

The automated-submission twin (`/runs/submissions`) is BK-2159, Deferred. Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1 })`, `TestsApi.archiveTest`, arena environment id
- Components: RunsApi (reuse), TestDetailPage NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Archived never-run Test | Generate | API | test | none, ends archived |

## 9. Checklist
- [ ] refuseRunFromArchivedTest naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (RunsApi has BK-1974, BK-1975, BK-1982, BK-1983 only)
