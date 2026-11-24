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
async keepRecordsAcrossArchiveAndRestore(args: { testId: string }): Promise<[APIResponse, GetTestResponse]> {
  const baseline = await this.captureRecords(args.testId);
  await this.archiveTest(args.testId);
  const [, archived] = await this.getTest(args.testId);
  expect(archived.test.archived_at).not.toBeNull();
  expect(await this.captureRecords(args.testId)).toEqual(baseline);
  const [response] = await this.restoreTest(args.testId);
  const [, restored] = await this.getTest(args.testId);
  expect(restored.test.archived_at).toBeNull();
  expect(await this.captureRecords(args.testId)).toEqual(baseline);
  return [response, restored];
}
```
`captureRecords` is a private helper returning `{ runIds, stepIds, tags, planIds, planMemberIds }`: Run ids from `GET /tests/{id}/runs` (all pages, sorted), step ids in chain order and tags from `GET /tests/{id}`, plan ids from `plans[]` (sorted) and, per plan, the sorted member Test ids from `GET /test-plans/{id}/tests`. The ATC first asserts the baseline is not empty (Runs, steps, plans). Runs still in progress are not in the history; the Test of this TC has finished Runs only. The plan member read is a private `TestsApi` method because an ATC never reaches into another component.

## 3A. API Details
`DELETE /tests/{id}`, `POST /tests/{id}/restore`, `GET /tests/{id}` (`atcs[].step_id`, `position`, `plans[]`, `tags`), `GET /tests/{id}/runs` (all pages).

## 4. Assertions Split
### Fixed (inside ATC)
After each action the Test is readable (archived after the first, live after the second); Run ids, step ids and chain order, tags, plan ids and each plan's member ids equal the baseline. Because the member ids are compared for every plan, "the plan still lists the Test" is inside the ATC.
### Test-level (in test file)
Preconditions read from the seeded Test: 2 chain steps, `run_count` 2, 3 plans, the tag. After the ATC the returned Test keeps title, `run_count` and plan ids.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-11 #1, AC-07 #2 | State Transition (live, archived, live) | 1 |

Reduction: none. Rollback of a failed archive is BK-2166, Deferred.

## 7. Dependencies
- `TestSeedSteps.seedWithHistory({ chainLength: 2, tags, finishedRuns: 2, plans: 3 })` (real path: start, mark every step passed, finish; plan create and add)
- Components: TestsApi, RunsApi (`startRun`, `markStep`, `finishRun`), PlansApi (`createPlan`, `addTests`), StructureApi (`listEnvironments`, `createEnvironment`)

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Test with 2 finished Runs, 2 chain steps, a tag, 3 plans | Generate | API | test | Test ends live and is archived by the shared teardown. Plans have no archive route and stay open; the arena environment `kata-bk596-env` is found or created once |

## 9. Checklist
- [ ] keepRecordsAcrossArchiveAndRestore naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature as in §2. Version is not asserted: the TC expected results do not list it, and the baseline records only what the TC names (Runs, steps, memberships, tags, chain).
- DB reads are replaced by product reads (plan §4.3). `PlansApi.listPlanTests` was not built: the per-plan member read lives in the ATC component as a private method.
- The 3 plans are created per run with a generated name and cannot be archived; they stay in the arena project as residue.
