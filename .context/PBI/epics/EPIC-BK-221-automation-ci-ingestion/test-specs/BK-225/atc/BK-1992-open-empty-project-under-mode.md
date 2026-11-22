# ATC Spec: BK-1992 — First-use state under any Mode

> Ticket: BK-1992 (TC32), Story BK-225
> Component: RunsReportPage (tests/components/ui/RunsReportPage.ts)
> Type: UI — Validation (state precedence)
> Parent Story: BK-225 (AC4 / 4.4; prior bug BK-1991; absorbs TC26)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should show the first-use state for any Mode given a project with no runs | Zero-run state wins over Mode | Project that never had a run; member signed in | 4.4 |

## 2. ATC Contract
```typescript
@atc('BK-1992')
async openEmptyProjectUnderMode(args: { slug: string, workspaceId: string, mode: 'all' | 'automated' | 'manual' }): Promise<void>
```
Fixed assertions:
- `report-empty-no-runs` is visible with the title "No runs yet for this Project"
- `report-empty-no-match` and `report-empty-no-automated` are not visible
- `report-filter-mode` has `data-mode-state` equal to the mode, and the Mode button of that mode is pressed

## 3B. UI Details
Navigate to `/projects/{slug}/runs` inside the ATC (precondition is the project, action is open + apply Mode). For `automated` and `manual`, click `report-mode-automated` or `report-mode-manual` and wait for the settled state with web-first assertions (the loading placeholder disappears). Copy comes from `report-view.ts` (`REPORT_EMPTY_NO_RUNS_TITLE`); the title is asserted as a literal string.

## 4. Assertions Split
### Fixed (inside ATC)
Section 2.
### Test-level (in test file)
- `report-total-manual` and `report-total-automated` read 0
- the empty project's report API (`getReport`) returns `scope {has_runs: false, has_automated: false}` (confirms the precondition, not only the screen)

## 5. Code Template
```typescript
@atc('BK-1992')
async openEmptyProjectUnderMode(args: EmptyArgs): Promise<void> {
  await this.page.goto(this.buildUrl(`/projects/${args.slug}/runs`));
  if (args.mode !== 'all') {
    await this.modeButton(args.mode).click();
  }
  await expect(this.page.getByTestId('report-empty-no-runs')).toContainText('No runs yet for this Project');
  await expect(this.page.getByTestId('report-empty-no-match')).toBeHidden();
  await expect(this.page.getByTestId('report-empty-no-automated')).toBeHidden();
  await expect(this.page.getByTestId('report-filter-mode')).toHaveAttribute('data-mode-state', args.mode);
}
```

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 4.4 | Decision Table: (project has runs?) x (Mode) decides the empty state; this TC owns the "no runs" column | 1 parameterized ATC, 3 rows |

| Parameterized ATC | Reduction applied | Rows after reduction |
|---|---|---|
| openEmptyProjectUnderMode | Decision Table (no runs: all, automated, manual all give first-use) | 3 |

BVA: N/A.

## 7. Dependencies
- `RunFixtureSteps.openMemberSession` + `discoverProject` for `kata-bk225-empty-runs`; the browser runs as the Member (`test.use({ storageState })`), and the ATC sets the `bk_active_ws` cookie to the project's workspace

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Never-run project `kata-bk225-empty-runs` in the Member's own workspace | Discover (created once by hand, the only creation allowed by ADR-0029 rule 5) | Member cookie, `GET /v1/workspaces/{id}/projects?slug=` | `beforeAll` | none |

## 9. Checklist
- [ ] verb{Resource}{Scenario} naming
- [ ] Max 2 positional params
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (BK-1992 free)
- [ ] No comments in code
