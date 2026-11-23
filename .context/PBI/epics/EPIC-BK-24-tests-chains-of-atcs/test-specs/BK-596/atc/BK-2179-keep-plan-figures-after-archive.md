# ATC Spec: BK-2179 - Plan figures and milestone readiness do not move after an archive

> Ticket: BK-2179 (TC40, absorbs TC41 BK-2180)
> Component: PlanFiguresPage (tests/components/ui/PlanFiguresPage.ts), NEW
> Type: UI - Verification (labelled integration, see OQ1 and OQ2)
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should keep open plan progress, milestone readiness and a closed plan snapshot identical after archiving a Test given a Test held by open and closed plans | An archived member still counts; a closed plan's frozen figures never change | Test in an open plan (attached to a milestone) and a closed plan; baselines captured | AC-04 4.6 |

## 2. ATC Contract
```typescript
@atc('BK-2179')
async expectFiguresUnchangedAfterArchive(args: { baseline: PlanFiguresBaseline, openPlanId: string, closedPlanId: string, milestoneId: string }): Promise<void> {
  const after = await this.readFigures(args);
  expect(after.openPlan).toEqual(args.baseline.openPlan);
  expect(after.milestone).toEqual(args.baseline.milestone);
  expect(after.closedPlan).toEqual(args.baseline.closedPlan);
}
```
`readFigures` (public `@step` helper, also used for the baseline) opens the plan and milestone pages and reads `test-plan-progress`, `test-plan-progress-percent`, `test-plan-progress-passed`, `milestone-readiness`, `milestone-readiness-percent` as text.

## 3B. UI Details
Plan and milestone routes are not in the TC; discover at Code time. There is no endpoint for plan progress or milestone readiness, no framework DB client, and the progress functions are not callable with a user token (spec.md OQ1). The closed plan page shows the frozen progress; the TC's "byte-identical `progress_snapshot`" is approximated by the rendered frozen values until a DB read path is decided.

## 4. Assertions Split
### Fixed (inside ATC)
Open plan, milestone and closed plan figures equal their baselines.
### Test-level (in test file)
Archive 204 via `TestsApi.archiveTest` between baseline and ATC; `PlansApi.listPlanTests` of both plans still lists the Test (no membership row added or removed); `restoreTest` in teardown.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-04 4.6 | EP (single partition: Test held by open and closed plans) | 1 |

Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedTest` with a passed finished Run, `seedPlans({ open: true, closed: true, milestone: true })`
- Components: PlanFiguresPage NEW, PlansApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Open plan in a milestone, closed plan | Generate through the real path | `POST /projects/{id}/test-plans`, `POST /test-plans/{id}/tests`, `POST /test-plans/{id}/close` (verdict), `POST /projects/{id}/milestones`, `POST .../milestones/{id}/plans` | test | restore the Test; plans and milestone left closed or archived |

## 9. Checklist
- [ ] expectFiguresUnchangedAfterArchive naming
- [ ] One object param
- [ ] void return (UI)
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
