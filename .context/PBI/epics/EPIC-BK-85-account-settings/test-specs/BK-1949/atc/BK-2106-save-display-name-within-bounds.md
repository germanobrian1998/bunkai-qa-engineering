# ATC Spec: BK-2106 — Save a display name within bounds

> Ticket: BK-2106 (TC7), Story BK-1949
> Component: DisplayNameApi, new
> Type: API — Positive / Boundary
> Parent Story: BK-1949 (AC 2.3, 2.5, E4, PO3)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should accept and store the name in full when it has 1 to 80 code points after trimming | Accept side of the 1..80 code-point range, counted in code points, trimmed before counting | Admin cookie session | AC 2.3, AC 2.5, E4 |

## 2. ATC Contract
```typescript
@atc('BK-2106')
async saveDisplayNameWithinBounds(args: {
  value: string,
  expectedStored: string,
}): Promise<[APIResponse, DisplayNameResponse, DisplayNameBody]>
```
Fixed assertions:
- status 200
- `body.display_name` equals `args.expectedStored` (literal from the row)
- read-back (`GET /v1/me`): `user.display_name` equals `args.expectedStored`

## 3A. API Details
`PUT /v1/me/display-name`. Code-point count is `[...value].length`; combining marks and each emoji count once; trim runs before the count (outer spaces, NBSP, zero-width).

## 4. Assertions Split
### Fixed: section 2.
### Test-level
- `afterAll` restore of the original name

## 5. Parameter table (literal, from the TC)
| # | case | value | expectedStored |
|---|------|-------|----------------|
| 1 | 1 code point (lower edge) | `'E'` | `'E'` |
| 2 | 79 code points | `'A'.repeat(79)` | `'A'.repeat(79)` |
| 3 | 80 code points (upper edge) | `'A'.repeat(80)` | `'A'.repeat(80)` |
| 4 | 80 emoji (160 UTF-16 units) | `'\u{1F600}'.repeat(80)` | `'\u{1F600}'.repeat(80)` |
| 5 | 80 combining marks | `'e' + '́'.repeat(79)` | same string |
| 6 | 80 plus outer spaces | `'   ' + 'A'.repeat(80) + '   '` | `'A'.repeat(80)` |

Pending OQ1 (not planned until its owner adds it): raw 1000 characters accepted, e.g. `' '.repeat(995) + 'Elena'` stored `'Elena'`; it is the accept side of the 1000 raw cap that BK-2107 refuses at 1001.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 2.3, 2.5, E4 | BVA accept side (1, 79, 80) + EP on unit + trim-before-count | 1 parameterized ATC, 6 rows (one outcome class: 200 stored in full) |

BVA detail
| Field + range | Boundary rows |
|---------------|---------------|
| length 1..80 code points | 1, 79, 80 (accept); 0 in BK-2105; 81 in BK-2107 |
| raw length <= 1000 | accept edge unsigned (OQ1); 1001 in BK-2107 |

## 7. Dependencies
- `DisplayNameSteps.openRoleSession('admin')`, `DisplayNameApi.readStoredName`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Account name overwritten per row | Modify | the ATC itself | per row | restore original in `afterAll` |

## 9. Checklist
- [ ] Row table is literal (`repeat`, `\u` escapes), no faker
- [ ] Max 2 positional params
- [ ] No whole-body key-set assertion
- [ ] Not duplicating an existing ATC (BK-2106 free)
- [ ] No comments in code
