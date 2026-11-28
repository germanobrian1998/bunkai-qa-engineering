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
async expectFiguresUnchangedAfterArchive(args: { baseline: PlanFiguresBaseline, scope: PlanFiguresScope }): Promise<void> {
  const after = await this.readFigures(args.scope);
  expect(after.openPlan).toEqual(args.baseline.openPlan);
  expect(after.milestone).toEqual(args.baseline.milestone);
  expect(after.closedPlan).toEqual(args.baseline.closedPlan);
}
```
`PlanFiguresScope` is `{ projectSlug, workspaceId, openPlanId, closedPlanId, milestoneId }`. `readFigures(scope)` (public `@step` helper, also used for the baseline) sets the active workspace cookie, opens the open plan page, the milestone page and the closed plan page, navigates with `waitUntil: 'commit'`, then waits (30 s) for the figures card to be visible on each (the empty and unavailable states have other test ids, so they fail the wait) and reads as text `test-plan-progress-percent`, `test-plan-progress-passed`, every `test-plan-progress-chip-*` and `test-plan-progress-note` for a plan, and `milestone-readiness-percent`, every `milestone-readiness-chip-*` and `milestone-readiness-note` for the milestone.

## 3B. UI Details
Routes (product source): `/projects/{slug}/plans/{planId}` and `/projects/{slug}/milestones/{milestoneId}`: the plan page streams behind a Suspense skeleton (`test-plan-detail-skeleton`), the milestone page renders server-side without Suspense; navigation waits on `commit` and the visibility wait on the content testid (`test-plan-progress`, `milestone-readiness`) gates every read; the test is marked slow (`test.slow()`) because it performs 6 navigations. There is no endpoint for plan progress or milestone readiness (spec.md OQ1). A closed plan page renders the snapshot stored at close time (`progress_snapshot`) and its note says "Frozen at close time"; the TC "byte-identical `progress_snapshot`" is approximated by the rendered frozen figures. Plan and milestone creation, attach and close are real product routes (`POST /projects/{id}/test-plans`, `.../milestones`, `.../milestones/{id}/plans`, `POST /test-plans/{id}/close`); a milestone only accepts open plans, so the closed plan is not in the milestone.

## 4. Assertions Split
### Fixed (inside ATC)
Open plan, milestone and closed plan figures (percent, passed label, outcome chips, note) equal their baselines.
### Test-level (in test file)
Preconditions that keep the equality meaningful: the open plan reads 50 percent with "1 of 2", chips Passed 1 and Not run 1, live note; the milestone reads 50 percent; the closed plan, closed before the passed Run finished, reads 0 percent with "0 of 2" and the frozen note, so its frozen figures differ from the live ones and a live recompute (50 percent) would fail the equality. Archive 204 via `TestsApi.archiveTest` between baseline and ATC. After the ATC (kept in the spec, with an honest message, to keep one TC = one ATC), `PlansApi.listPlanMemberships` of both plans lists the same memberships (`id`, `added_at`, `added_by`) as before the archive (no membership row added or removed; `archived_at` of the Test row legitimately changes and is not compared).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-04 4.6 | EP (single partition: Test held by open and closed plans) | 1 |

Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedPlanFigures` (two Tests without tags, one never run; open plan holding both; closed plan holding both, closed before the passed Run finishes; then one finished passed Run; milestone with the open plan)
- Components: PlanFiguresPage NEW, PlansApi (`createPlan`, `addTests`, `closePlan`, `listPlanMemberships`, `createMilestone`, `attachPlans`, `archiveMilestone`), TestsApi

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Two Tests (no tags), one given a passed Run after the closed plan closes | Generate | `POST /tests`, `POST /runs`, mark, finish | test | both Tests archived by the shared teardown |
| Open plan in a milestone, closed plan, both with the two Tests | Generate through the real path | `POST /projects/{id}/test-plans`, `POST /test-plans/{id}/tests`, `POST /projects/{id}/milestones`, `POST .../milestones/{id}/plans`, `POST /test-plans/{id}/close` (`PLAN_FIGURES_CLOSE`) | test | the open plan is closed by the shared teardown (`PLAN_TEARDOWN`), the milestone is archived (`POST /milestones/{id}/archive`); the closed plan is not registered for teardown once its close succeeded; residue: 2 closed plans and 1 archived milestone per run |

## 9. Checklist
- [ ] expectFiguresUnchangedAfterArchive naming
- [ ] One object param
- [ ] void return (UI)
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature: `{ baseline, scope }` (the plan had `openPlanId`, `closedPlanId`, `milestoneId`; the page also needs the project slug and the workspace id for the active workspace cookie). The type of the figures is `PlanFiguresBaseline` in `tests/data/types.ts`.
- Two members, not one: a passed Test and a never-run Test, so the open plan reads 50 percent, 1 of 2. With one member an archive that dropped it from the count would leave an empty state; with two it moves the percent and the member count, so the equality can fail. The closed plan is closed with both members BEFORE the passed Run finishes (`seedPlanFigures` order), so its frozen snapshot reads 0 percent, 0 of 2 while a live recompute reads 50 percent, 1 of 2. Preconditions pin both literals; the equality therefore proves the page keeps the frozen snapshot (product `0095_plan_close.sql` stores `bunkai_plan_progress` at close, the plan page renders `progress_snapshot` for closed plans) and not a live recompute. Without this ordering the snapshot and the live figures coincide and the check cannot fail.
- The figures are read as text of product test ids; chips and notes use `textContent` (the passed label is upper-cased by CSS, so `innerText` would differ from the source copy). The milestone and plan states other than the figures card (empty, unavailable, skeleton) fail the visibility wait instead of producing an empty comparison.
- Shared state: every figure belongs to plans and a milestone generated for the test, so concurrent files cannot move them.
- `restoreTest` in teardown is dropped (the shared teardown archives the Tests). The milestone is archived and the open plan closed by `TestSeedSteps.teardown`; the closed plan is already closed. The TC "no row added to or removed from `test_plan_tests`" is the equality of the memberships (`id`, `added_at`, `added_by`) of both plans before and after, read with the new `PlansApi.listPlanMemberships` (the spec has no local reader; `TestsApi` keeps its own private reader because the KATA layer rule forbids a domain component importing another).
- The closed plan `progress_snapshot` byte equality is approximated by the rendered frozen figures (no DB client, no endpoint); recorded as a gap, not a silent pass.
