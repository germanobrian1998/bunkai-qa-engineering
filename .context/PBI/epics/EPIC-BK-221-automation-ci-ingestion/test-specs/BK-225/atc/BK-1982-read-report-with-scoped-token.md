# ATC Spec: BK-1982 — Report PAT scope gate

> Ticket: BK-1982 (TC29), Story BK-225
> Component: RunsApi (tests/components/api/RunsApi.ts)
> Type: API — Negative / Happy path (access control on a read)
> Parent Story: BK-225 (Business Rule V.2)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should answer 403 on the report endpoint to a PAT without atc:read and 200 with it | The `atc:read` gate holds | Readable project; two PATs | V.2 |

## 2. ATC Contract
```typescript
@atc('BK-1982')
async readReportWithScopedToken(args: { projectId: string, hasAtcRead: boolean }): Promise<[APIResponse, RunReportPage | ErrorEnvelope]>
```
Fixed assertions:
- `hasAtcRead: false`: status 403, `error.code` `forbidden` with `details.reason` `missing_capability`, body has no `items`, `totals` or `scope`
- `hasAtcRead: true`: status 200, body has `items` (array), `totals {passed, failed, manual, automated}` and `scope {has_runs, has_automated}`

## 3A. API Details
- Request: `GET /v1/projects/{id}/runs/report?executor=agent` (the TC's query). Bearer is the PAT held by the fixture used to call (`setAuthToken`).
- The exact 403 `code` and `details.reason` values come from the BK-572 precedent (`missing_capability`); confirm on the first run.

## 4. Assertions Split
### Fixed (inside ATC)
Section 2.
### Test-level (in test file)
- the main fixture with the TC's `executor=agent` query: `totals` equals `{passed:20, failed:6, manual:0, automated:26}` and `scope` equals `{has_runs: true, has_automated: true}` (literals)

## 5. Code Template
```typescript
@atc('BK-1982')
async readReportWithScopedToken(args: ScopeArgs): Promise<[APIResponse, RunReportPage | ErrorEnvelope]> {
  const [response, body] = await this.apiGET<RunReportPage | ErrorEnvelope>(
    `/v1/projects/${args.projectId}/runs/report?executor=agent`,
  );
  expect(response.status()).toBe(args.hasAtcRead ? 200 : 403);
  return [response, body];
}
```

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| V.2 | EP on PAT scope (absent, present) | 1 parameterized ATC, 2 rows |

BVA: N/A. Reduction axes: none.

## 7. Dependencies
- `RunFixtureSteps.openOwnerSession`, `discoverProject`, `mintBearer`
- `AuthApi.provisionToken` with `name` for two PATs (`['atc:read']`, `['run:execute']`)

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Readable project (main fixture) | Discover | `GET /v1/workspaces/{id}/projects?slug=` | `beforeAll` | none |
| Two PATs | Generate | `POST /v1/tokens` with the cookie | `beforeAll` | `DELETE /v1/tokens/{id}` in `afterAll` |

## 9. Checklist
- [ ] verb{Resource}{Scenario} naming
- [ ] Max 2 positional params
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (BK-1982 free)
- [ ] No comments in code; PAT never logged (`redactKeys: ['token']`)
