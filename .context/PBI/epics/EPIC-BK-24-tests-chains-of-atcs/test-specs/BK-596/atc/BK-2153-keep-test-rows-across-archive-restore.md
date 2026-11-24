# ATC Spec: BK-2153 - Nothing destroyed across archive and restore

> Ticket: BK-2153 (TC14)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - Verification
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should keep the Test row and every Run, step and plan membership unchanged across archive and restore | Archive and restore never edit or remove the Test, its Runs, chain steps or plan memberships | Test with 2 Runs, 2 chain steps, 3 plan memberships | AC-11 #1, AC-07 #2 |

## 2. ATC Contract
```typescript
@atc('BK-2153')
async keepRecordsAcrossArchiveAndRestore(args: { testId: string }): Promise<[APIResponse, TestBody]> {
  const baseline = await this.captureRecords(args.testId);
  expect((await this.archiveTest(args.testId))[0].status()).toBe(204);
  expect(await this.captureRecords(args.testId)).toEqual({ ...baseline, archived: true });
  const [response, body] = await this.restoreTest(args.testId);
  expect(response.status()).toBe(200);
  expect(await this.captureRecords(args.testId)).toEqual({ ...baseline, archived: false });
  return [response, body as unknown as TestBody];
}
```
`captureRecords` is a private helper returning `{ archived, runIds, stepIds, atcOrder, planIds, tags }` from `GET /tests/{id}` (200 proves the row exists) and `GET /tests/{id}/runs`. Runs still in progress are not in the history; the Test of this TC has finished Runs only.

## 3A. API Details
`DELETE /tests/{id}`, `POST /tests/{id}/restore`, `GET /tests/{id}` (`atcs[].step_id`, `position`, `plans[]`, `tags`), `GET /tests/{id}/runs` (all pages).

## 4. Assertions Split
### Fixed (inside ATC)
After each action the Test is readable; Run ids, step ids and chain order, plan ids and tags equal the baseline.
### Test-level (in test file)
`PlansApi.listPlanTests` of each of the 3 plans still lists the Test after each action.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-11 #1, AC-07 #2 | State Transition (live, archived, live) | 1 |

Reduction: none. Rollback of a failed archive is BK-2166, Deferred.

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 2, finishedRuns: 2, plans: 3 })`
- Components: TestsApi NEW, PlansApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Runs, steps, 3 plans | Generate | API | test | Test ends live; archived in `afterAll` |

## 9. Checklist
- [ ] keepRecordsAcrossArchiveAndRestore naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
