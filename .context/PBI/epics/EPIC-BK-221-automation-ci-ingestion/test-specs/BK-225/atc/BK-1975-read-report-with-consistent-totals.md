# ATC Spec: BK-1975 — Report totals invariant

> Ticket: BK-1975 (TC22), Story BK-225
> Component: RunsApi (tests/components/api/RunsApi.ts)
> Type: API — Verification (the response is the business outcome)
> Parent Story: BK-225 (AC3 / 3.1, 3.2, 3.3, I3; absorbs TC15, TC16, TC17)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should keep Manual plus Automated equal to Passed plus Failed across API totals, UI chips and database counts for every filter combination | Invariant triangulation; running and aborted listed, not counted | Project with all executors and statuses plus a pre-feature run | 3.1 to 3.3 |

## 2. ATC Contract
```typescript
@atc('BK-1975')
async readReportWithConsistentTotals(args: {
  projectId: string,
  query: Record<string, string[]>,
}): Promise<[APIResponse, RunReportPage]>
```
Fixed assertions:
- status 200; body has `totals {passed, failed, manual, automated}` (numbers) and `scope {has_runs, has_automated}` (booleans)
- `totals.manual + totals.automated === totals.passed + totals.failed`
- no `aborted` or `running` key in `totals`

## 3A. API Details
- `GET /v1/projects/{id}/runs/report` with the query (repeatable `status`, `executor`). Types `RunReportPage`. Tuple return.

## 4. Assertions Split
### Fixed (inside ATC)
Section 2.
### Test-level (in test file)
Recipe (fixture `qa-bk-225-fixture-20261117-manual-only`): human 3 passed, 2 failed, 4 aborted; agent 1 passed, 1 failed; ci 1 aborted; no running run. Literals per Examples row:
| Row | Query | passed | failed | manual | automated | listed statuses |
|-----|-------|--------|--------|--------|-----------|-----------------|
| no filter | (none) | 4 | 3 | 5 | 2 | passed, failed, aborted (12 rows) |
| Status Failed | `status=failed` | 0 | 3 | 2 | 1 | failed (3 rows) |
| Failed + Automated | `status=failed&executor=agent&executor=ci` | 0 | 1 | 0 | 1 | failed (1 row) |
| Status Aborted | `status=aborted` | 0 | 0 | 0 | 0 | aborted (5 rows) |
- UI chips (`report-total-passed|failed|manual|automated`) equal the API totals after applying the same filters in the view; no Aborted chip; Status Aborted shows four zeros with one aborted row
- recipe oracle: the same counts derive from the manual-only fixture recipe; DB MCP count by executor_mode recorded at Code time (O3)
- running run not counted and legacy run (O2): two extra rows, each `test.skip(true, reason)`: no fixture holds a running run, and no reachable pre-feature run exists (ADR-0029 rule 4)

## 5. Code Template
```typescript
@atc('BK-1975')
async readReportWithConsistentTotals(args: TotalsArgs): Promise<[APIResponse, RunReportPage]> {
  const [response, body] = await this.apiGET<RunReportPage>(`/v1/projects/${args.projectId}/runs/report`, { params: toParams(args.query) });
  expect(response.status()).toBe(200);
  const { totals } = body;
  expect(totals.manual + totals.automated).toBe(totals.passed + totals.failed);
  return [response, body];
}
```
(`toParams` must support repeated keys; if `RequestOptions.params` cannot, build the query string in the helper.)

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 3.1 to 3.3 | EP over filter combinations; State-Transition on run status (counted: passed, failed; not counted: running, aborted); invariant triangulation | 1 parameterized ATC, 4 rows |

| Parameterized ATC | Reduction applied | Rows after reduction |
|---|---|---|
| readReportWithConsistentTotals | Decision Table over (Status, Mode) kept the 4 signed combinations; full Mode x Status x Module x Date pairwise is TC12 (Deferred) | 4 |

BVA: N/A (counts, no range).

## 7. Dependencies
- `RunFixtureSteps.discoverProject` + `assertComposition` on the manual-only fixture
- `RunsReportPage.readTotals()` helper for the chips

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Manual-only fixture (12 runs) | Discover | `GET /v1/workspaces/{id}/projects?slug=`, composition verified, never topped up | `beforeAll` | none |
| Pre-feature run | none available | not reachable by the Owner | n/a | `test.skip(true, reason)` |

## 9. Checklist
- [ ] verb{Resource}{Scenario} naming
- [ ] Max 2 positional params
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (BK-1975 free)
- [ ] No comments in code
