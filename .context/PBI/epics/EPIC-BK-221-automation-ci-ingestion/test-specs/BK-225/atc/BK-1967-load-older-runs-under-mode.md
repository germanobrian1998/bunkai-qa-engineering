# ATC Spec: BK-1967 — Load older runs under Mode Automated

> Ticket: BK-1967 (TC14), Story BK-225
> Component: RunsReportPage (tests/components/ui/RunsReportPage.ts)
> Type: UI — State change (pagination)
> Parent Story: BK-225 (AC2 / 2.5, AC3 / 3.4; absorbs TC18)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should show full-set per-mode totals before page 2 and keep Mode Automated applied on both pages | Totals are server-side over the whole filtered set; Mode survives the cursor | 51 automated and 10 manual finished runs; member on the Runs view | 2.5, 3.4 |

## 2. ATC Contract
```typescript
@atc('BK-1967')
async loadOlderRunsUnderMode(args: {
  mode: 'automated',
  expected: { manual: number, automated: number, pageOneRows: number, rowsAfterPageTwo: number },
}): Promise<void>
```
Fixed assertions:
- after selecting the Mode, `report-total-manual` and `report-total-automated` read `expected.manual` (0) and `expected.automated` (51) while `report-load-older` is still visible (before page 2): totals follow the executor filter (AC 3.2, migration 0137)
- page 1 holds `expected.pageOneRows` rows, every row badge `data-mode="automated"`
- after clicking `report-load-older` (wrapped in `interceptResponse`), the list holds `expected.rowsAfterPageTwo` rows, no `data-mode="manual"` badge exists, `report-load-older` is gone
- totals after page 2 equal totals before page 2
- the page-2 request carries `executor=agent&executor=ci` and a `cursor`

## 3B. UI Details
- Page `/projects/{slug}/runs`; Mode selection through a `private` helper `selectMode(mode)` shared with BK-1963 (an ATC never calls an ATC; this is a private method, not an ATC).
- The loading state: totals show `—` while a request is in flight; the totals assertions use web-first `expect(...).toHaveText(...)` which waits for the settled value, never a timeout.

## 4. Assertions Split
### Fixed (inside ATC)
All bullets of section 2. Literals: `expected = { manual: 0, automated: 51, pageOneRows: 50, rowsAfterPageTwo: 53 }` supplied by the test (53 = 51 finished + 2 aborted automated runs listed, not counted), the page size 50 from `RUN_REPORT_PAGE_SIZE`.
### Test-level (in test file)
- before Mode: the unfiltered chips read Passed 47, Failed 14, Manual 10, Automated 51 (the full-set per-mode totals)
- `getReport` helper with `executor=agent&executor=ci`: API totals equal the UI chips and the literal `{passed:40, failed:11, manual:0, automated:51}` (API oracle)
- database count by executor_mode: DB MCP at Code time, recorded as PR evidence (O3)
- fixture health: `assertComposition` fails "fixture broken: <project> holds <counts>, expected <counts>" if the counts drifted

## 5. Code Template
```typescript
@atc('BK-1967')
async loadOlderRunsUnderMode(args: LoadOlderArgs): Promise<void> {
  await this.selectMode(args.mode);
  await expect(this.total('manual')).toHaveText(`Manual ${args.expected.manual}`);
  await expect(this.total('automated')).toHaveText(`Automated ${args.expected.automated}`);
  await expect(this.rows()).toHaveCount(args.expected.pageOneRows);
  const { request } = await this.interceptResponse<unknown, RunReportPage>({
    action: async () => this.loadOlder().click(),
    urlPattern: /\/runs\/report\?.*cursor=/,
  });
  expect(new URL(request.url).searchParams.getAll('executor').sort()).toEqual(['agent', 'ci']);
  await expect(this.rows()).toHaveCount(args.expected.rowsAfterPageTwo);
}
```

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 2.5, 3.4 | BVA on the 50-row page size (50 + 1) | 1 ATC, 1 row (51 / 10) |

**BVA detail**
| Field + range | Boundary ATCs |
|---------------|---------------|
| Page size 50 | The signed TC fixes page size + 1 only. 49, 50 and 51 automated runs would need 3 fixtures (not signed, not planned). `limit=50` and `limit=51` are exercised at the API in BK-1983 |

Reduction axes: none (1 row).

## 7. Dependencies
- `RunFixtureSteps.discoverProject` + `assertComposition` on the main fixture (shared with BK-1983)
- `RunsApi.getReport` helper for the API oracle

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Main fixture `qa-bk-225-fixture-20261117`: 51 automated + 10 human finished runs, plus 1 aborted run per executor | Discover | `GET /v1/workspaces/{id}/projects?slug=`, composition verified, never topped up (ADR-0029) | `beforeAll` | none, shared frozen fixture |

## 9. Checklist
- [ ] verb{Resource}{Scenario} naming
- [ ] Max 2 positional params
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (BK-1967 free)
- [ ] No comments in code
