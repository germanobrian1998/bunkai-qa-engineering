# ATC Spec: BK-1963 — Filter runs by Mode preset

> Ticket: BK-1963 (TC10), Story BK-225
> Component: RunsReportPage (tests/components/ui/RunsReportPage.ts)
> Type: UI — State change (Verification of a filter preset)
> Parent Story: BK-225 (AC2 / 2.1, 2.2; absorbs TC1, TC2, TC11)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should list only the preset's runs with matching badges and send the preset's executor params when Mode is Manual or Automated | Mode is a preset over Executor: right rows, right badge, right request | Project with finished human, agent and ci runs; member signed in on its Runs view | 2.1, 2.2, 1.1, 1.2 |

## 2. ATC Contract
```typescript
@atc('BK-1963')
async filterRunsByMode(args: { mode: 'manual' | 'automated', expectedRows: number })
```
Fixed assertions:
- the listed row count equals `expectedRows` (11 Manual, 50 Automated page 1: run ids are not literal under a frozen fixture, ADR-0029)
- every row has `run-mode-badge` with `data-mode` equal to the mode, visible text Manual or Automated, and an icon (svg) inside
- the Executor cell of every row reads Human (manual) or Agent / CI (automated)
- `report-executor-human` is pressed for manual; `report-executor-agent` and `report-executor-ci` are pressed and `report-executor-human` is not for automated; the Mode button of the chosen mode is pressed and `report-filter-mode` has `data-mode-state` equal to the mode
- the intercepted report request has `executor` values `['human']` or `['agent','ci']` (order-insensitive) and no `mode` key

## 3B. UI Details
- Page path: `/projects/{slug}/runs`; navigation by `ui.runsReport.goto({ slug })` BEFORE the ATC.
- Trigger: click `report-mode-manual` or `report-mode-automated` wrapped in `interceptResponse` (UiBase) so the request URL and the response are read from the real call; the row assertions wait on the list, not on time.
- Locators: inline testids listed in automation-plan section 2. `reportRows` is shared with BK-1967 and BK-1992 helpers, so it becomes a `private readonly` arrow.
- Executor cell: 5th `td` of the row until a testid exists (O4).

## 4. Assertions Split
### Fixed (inside ATC)
All bullets of section 2.
### Test-level (in test file)
- unfiltered view lists 50 rows with scope label "50 runs loaded in current scope · more available" before the click (precondition proof)
- `report-scope-label` text per mode ("11 runs in current scope" for Manual, "50 runs loaded in current scope · more available" for Automated), literal
- the row counts come from the main fixture recipe (human 7+3+1 = 11; automated 53, page 1 of 50), never from the response

## 5. Code Template
```typescript
@atc('BK-1963')
async filterRunsByMode(args: { mode: Mode, expectedRows: number }): Promise<void> {
  const { mode, expectedRows } = args;
  const { request } = await this.interceptResponse<unknown, RunReportPage>({
    action: async () => this.modeButton(mode).click(),
    urlPattern: /\/runs\/report\?/,
  });
  const executors = new URL(request.url).searchParams.getAll('executor').sort();
  expect(executors).toEqual(EXECUTORS_BY_MODE[mode]);
  expect(new URL(request.url).searchParams.has('mode')).toBe(false);
  await expect(this.rows()).toHaveCount(expectedRows);
}
```
(Skeleton only; confirm the exact `interceptResponse` argument names against `UiBase` at Code time.)

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 2.1, 2.2 | EP over the two presets (same behavior class, different executors) | 1 parameterized ATC, 2 test rows |

**EP detail**
| Input | Expected output | Same ATC? |
|-------|-----------------|-----------|
| Mode Manual | human rows only, `executor=human` | Yes (parameter) |
| Mode Automated | agent + ci rows only, `executor=agent&executor=ci` | Yes (parameter) |

**BVA**: N/A (no range). Reduction axes: none (2 rows).

## 7. Dependencies
- `RunFixtureSteps.discoverProject` + `assertComposition` on the main fixture
- New components: `RunsReportPage` (UI), `RunsApi`, `ProjectApi`, `AuthoringApi` (via the Steps)

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Main fixture `qa-bk-225-fixture-20261117` (human 7/3/1, agent 20/6/1, ci 20/5/1 as passed/failed/aborted) | Discover | `GET /v1/workspaces/{id}/projects?slug=`, composition checked | `beforeAll` | none, nothing written; PAT revoked |

## 9. Checklist
- [ ] verb{Resource}{Scenario} naming
- [ ] Max 2 positional params (object used)
- [ ] void return (UI)
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (manifest checked: BK-1963 free)
- [ ] No comments in code
