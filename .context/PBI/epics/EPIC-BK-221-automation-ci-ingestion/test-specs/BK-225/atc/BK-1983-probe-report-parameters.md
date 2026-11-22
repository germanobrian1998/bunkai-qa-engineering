# ATC Spec: BK-1983 — Report parameter abuse

> Ticket: BK-1983 (TC30), Story BK-225
> Component: RunsApi (tests/components/api/RunsApi.ts)
> Type: API — Negative / Validation
> Parent Story: BK-225 (charter result; prior bug BK-1990)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should reject invalid report parameters and ignore any mode parameter when the report API is probed | Validation contract; no 500 with a database message | Project with more than 50 runs; PAT `atc:read` | beyond AC, BK-1990 |

## 2. ATC Contract
```typescript
@atc('BK-1983')
async probeReportParameters(args: {
  projectId: string,
  query: string,
  expected: { status: 200 | 400 | 422, items?: number, nextCursor?: boolean },
}): Promise<[APIResponse, RunReportPage | ErrorEnvelope]>
```
Fixed assertions:
- status equals `expected.status`, never 500
- 4xx: body is an `ErrorEnvelope` (`error.code` is `validation_failed` for 422, `bad_request` for 400) and the message does not match a database error (`/invalid input syntax|out of range|date\/time field/i`)
- 200: body has `items`, `totals`, `scope`; when `expected.items` is set, `items.length` equals it; when `expected.nextCursor` is true, `next_cursor` is a non-empty string

## 3A. API Details
`GET /v1/projects/{id}/runs/report?{query}`. The query is a raw string so repeated keys, `mode`, bad dates and `cursor=garbage` are sent byte-for-byte. Validation source: `report-validation.ts` (`isCalendarDate`, `limit` 1..50, enums), `decodeRunCursor` (400).

## 4. Assertions Split
### Fixed (inside ATC)
Section 2.
### Test-level (in test file)
- repeated executor: item ids equal those of `executor=agent` (second call through `getReport`)
- `mode=automated`: first page has 50 items and `totals.passed + totals.failed` equals 61 (literal), proving the parameter is ignored
- `limit=50`: 50 items and `next_cursor` present

## 5. Code Template
```typescript
@atc('BK-1983')
async probeReportParameters(args: ProbeArgs): Promise<[APIResponse, RunReportPage | ErrorEnvelope]> {
  const [response, body] = await this.apiGET<RunReportPage | ErrorEnvelope>(
    `/v1/projects/${args.projectId}/runs/report?${args.query}`,
  );
  expect(response.status()).toBe(args.expected.status);
  return [response, body];
}
```

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| charter | Error guessing + EP (invalid enums, dates, cursor, repeated/unknown params) + BVA on `limit` | 1 parameterized ATC, 10 rows |

**EP detail**
| Input | Expected output | Same ATC? |
|-------|-----------------|-----------|
| `executor=robot`, `status=running` | 422 | Yes |
| inverted dates, `2026-02-30`, `2026-13-45` | 422 (BK-1990) | Yes |
| `limit=51` | 422 | Yes |
| `cursor=garbage` | 400 | Yes (different status, kept in the same table; the TC owns the table) |
| repeated executor, `mode=...` | 200 | Yes |

**BVA detail**
| Field + range | Boundary rows |
|---------------|---------------|
| `limit` 1..50 | Signed rows: 50 (200) and 51 (422). 0 and 1 are not in the signed table: not added |
| `date_from` real calendar date | Signed rows: `2026-02-30`, `2026-13-45`. Leap day `2024-02-29` (valid) not signed: not added |

Reduction axes: none (table already minimal).

## 7. Dependencies
- Main fixture via `RunFixtureSteps.discoverProject` + `assertComposition` (read-only)
- `RunsApi.getReport` helper

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Project with 61 finished runs (main fixture, plus 3 aborted) | Discover | `GET /v1/workspaces/{id}/projects?slug=`, composition verified | `beforeAll` | none |
| PAT `atc:read` | Generate | `POST /v1/tokens` | `beforeAll` | revoke in `afterAll` |

## 9. Checklist
- [ ] verb{Resource}{Scenario} naming
- [ ] Max 2 positional params
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (BK-1983 free)
- [ ] No comments in code
