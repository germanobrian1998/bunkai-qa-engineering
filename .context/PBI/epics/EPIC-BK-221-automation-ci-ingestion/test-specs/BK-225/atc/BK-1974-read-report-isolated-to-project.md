# ATC Spec: BK-1974 — Report isolated to its project

> Ticket: BK-1974 (TC21), Story BK-225
> Component: RunsApi (tests/components/api/RunsApi.ts)
> Type: API — Negative / Verification (read whose response is the business outcome)
> Parent Story: BK-225 (AC3 / 3.7)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should exclude other projects' runs from rows and per-mode totals and answer 404 for a foreign-workspace project | No cross-project leak; no existence disclosure | Project A (5 automated), sibling B (3), foreign project; member with `atc:read` PAT | 3.7 |

## 2. ATC Contract
```typescript
@atc('BK-1974')
async readReportIsolatedToProject(args: {
  projectId: string,
  expected: { status: 200, automated: number, manual: number, rows: number } | { status: 404 },
}): Promise<[APIResponse, RunReportPage | ErrorEnvelope]>
```
Fixed assertions:
- `status 200`: `totals.automated` equals `expected.automated` (2), `totals.manual` equals `expected.manual` (5), `items.length` equals `expected.rows` (12), `scope.has_automated` is true
- `status 404`: `error.code` is `not_found`, `error.details.reason` is `not_found`, no `items`, `totals` or `scope` in the body

## 3A. API Details
- `GET /v1/projects/{id}/runs/report` with the workspace-bound PAT as Bearer. Types `RunReportPage`, `ErrorEnvelope` from `@schemas/runs.types`. Return tuple `[APIResponse, TBody]`.
- The discriminated `expected` argument is the convention flagged in O1 (one method per ID, two statuses).

## 4. Assertions Split
### Fixed (inside ATC)
Section 2.
### Test-level (in test file)
- same-workspace row (project A = manual-only fixture, sibling = main fixture): A's report ids are disjoint from the sibling's first page; A's Runs view reads Passed 4, Failed 3, Manual 5, Automated 2 and its `report-row-*` ids equal A's API ids (a leak changes the counts)
- foreign row: the body equals the body returned for a random unused UUID (`error.code`, `error.message`); (read with the Owner cookie: a workspace-bound PAT is not needed for a 404)
- both projects are in the Owner's workspace for the same-workspace row; the foreign one (`qa-bk-225-fixture-20261117-automated-onl`) is in the Member's own workspace

## 5. Code Template
```typescript
@atc('BK-1974')
async readReportIsolatedToProject(args: IsolationArgs): Promise<[APIResponse, RunReportPage | ErrorEnvelope]> {
  const [response, body] = await this.apiGET<RunReportPage | ErrorEnvelope>(`/v1/projects/${args.projectId}/runs/report`);
  expect(response.status()).toBe(args.expected.status);
  if (args.expected.status === 200) {
    const page = body as RunReportPage;
    expect(page.totals.automated).toBe(args.expected.automated);
    expect(page.totals.manual).toBe(0);
  }
  else {
    expect((body as ErrorEnvelope).error.code).toBe('not_found');
  }
  return [response, body];
}
```

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 3.7 | EP on project scope (own, sibling in workspace, other workspace) | 1 parameterized ATC, 2 rows |

**EP detail**
| Input | Expected output | Same ATC? |
|-------|-----------------|-----------|
| Own project A | 200, totals count only A | Yes |
| Foreign-workspace project | 404 not_found, identical to a missing project | Yes (convention, O1) |
| Non-existent UUID | 404 not_found (comparison baseline, test-level) | Helper call |

BVA: N/A. Reduction axes: none.

## 7. Dependencies
- `RunFixtureSteps`: Discover the manual-only and main fixtures (Owner) and the automated-onl fixture (Member session); verify each recipe
- Role projects matcher change (plan D4)

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| A (manual-only), sibling (main) in the Owner's workspace | Discover | `GET /v1/workspaces/{id}/projects?slug=`, composition verified | `beforeAll` | none |
| Foreign project `qa-bk-225-fixture-20261117-automated-onl` | Discover (Member's own workspace) | Member cookie, `GET /v1/me`, `GET /v1/workspaces/{id}/projects?slug=` | `beforeAll`, `fixture broken` when absent | none |

## 9. Checklist
- [ ] verb{Resource}{Scenario} naming
- [ ] Max 2 positional params
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (BK-1974 free)
- [ ] No comments in code
