# ATC Spec: BK-2105 — Refuse a blank display name

> Ticket: BK-2105 (TC6), Story BK-1949
> Component: DisplayNameApi (tests/components/api/DisplayNameApi.ts), new
> Type: API — Negative / Validation
> Parent Story: BK-1949 (AC 2.1, 2.2, E3, PO3)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should refuse the save with "The display name cannot be empty." and keep the previous name when the value is blank after trimming | Every blank class is trimmed to nothing and refused; the stored name does not change | Admin cookie session; own name saved (7 rows) or none (2 rows) | AC 2.1, AC 2.2, E3 |

## 2. ATC Contract
```typescript
@atc('BK-2105')
async refuseBlankDisplayName(args: {
  value: string,
  unchangedName: string | null,
}): Promise<[APIResponse, ErrorEnvelope, DisplayNameBody]>
```
Fixed assertions:
- status 422, `error.code` `validation_failed`
- `error.message` equals the literal `The display name cannot be empty.` (from `DISPLAY_NAME_MESSAGES.empty`, never from the body)
- `error.details.field` equals `display_name`
- read-back through the same caller (`GET /v1/me`): `user.display_name` equals `args.unchangedName`

## 3A. API Details
`PUT /v1/me/display-name`, body `{ display_name: value }`. Server order: raw length, trim (every `\s` plus U+200B..U+200D, U+2060), empty check. Tab and newline at the edges are trimmed first, so they get the empty message, not the control-character one.

## 4. Assertions Split
### Fixed (inside ATC)
Section 2.
### Test-level (in test file)
- `beforeAll` capture, `afterAll` restore; per row arrange `saveName(prior)` or `removeName()`

## 5. Parameter table (literal, from the TC)
| # | prior | value |
|---|-------|-------|
| 1 | generated name | `''` |
| 2 | generated name | `'     '` |
| 3 | generated name | `' '.repeat(3)` |
| 4 | generated name | `'　'` |
| 5 | generated name | `'​'.repeat(3)` |
| 6 | generated name | `'⁠﻿'` |
| 7 | generated name | `'\t \n'` |
| 8 | null | `''` |
| 9 | null | `'     '` |

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 2.1, 2.2, E3 | EP (blank classes) + ST (prior saved vs none) + BVA lower edge 0 | 1 parameterized ATC, 9 rows (same outcome, no split) |

BVA detail: length 0 is row 1; length 1 is accepted in BK-2106. Reduction axes: none.

## 7. Dependencies
- `DisplayNameSteps.openRoleSession('admin')`, `DisplayNameApi.saveName`, `removeName`, `readStoredName`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Own name saved or none | Modify | `saveName` / `removeName` | per row (`beforeEach`) | restore original in `afterAll` |

## 9. Checklist
- [ ] Literal message and code, no recomputation from the response
- [ ] Max 2 positional params, object arg used
- [ ] Tuple return, no whole-body key-set assertion
- [ ] Not duplicating an existing ATC (BK-2105 free in the manifest)
- [ ] No comments in code
