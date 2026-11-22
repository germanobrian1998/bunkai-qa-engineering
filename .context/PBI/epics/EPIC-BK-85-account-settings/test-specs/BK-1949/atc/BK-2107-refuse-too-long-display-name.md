# ATC Spec: BK-2107 — Refuse an over-limit display name

> Ticket: BK-2107 (TC8), Story BK-1949
> Component: DisplayNameApi, new
> Type: API — Negative / Boundary
> Parent Story: BK-1949 (AC 2.4, E4, dev review fix raw cap 1000)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should refuse the save with "The name must be at most 80 characters." and keep the previous name when the value exceeds 80 code points or 1000 raw characters | Refuse side of the range and of the raw cap; the stored name does not change | Admin cookie session; own name saved | AC 2.4, E4 |

## 2. ATC Contract
```typescript
@atc('BK-2107')
async refuseTooLongDisplayName(args: {
  value: string,
  unchangedName: string,
}): Promise<[APIResponse, ErrorEnvelope, DisplayNameBody]>
```
Fixed assertions:
- status 422, `error.code` `validation_failed`
- `error.message` equals the literal `The name must be at most 80 characters.`
- `error.details.field` equals `display_name`
- read-back: `user.display_name` equals `args.unchangedName`

## 3A. API Details
Server order: raw `length` > 1000 (UTF-16 units) refused first with this same message; otherwise trim, forbidden characters, then code points > 80. Row 4 therefore tests the raw cap and not the code-point cap (5 code points once trimmed).

## 4. Assertions Split
### Fixed: section 2.
### Test-level
- arrange `saveName(savedName)` before each row; `afterAll` restore

## 5. Parameter table (literal, from the TC)
| # | case | value |
|---|------|-------|
| 1 | 81 code points (refuse edge) | `'A'.repeat(81)` |
| 2 | 81 emoji (162 UTF-16 units) | `'\u{1F600}'.repeat(81)` |
| 3 | 81 combining marks | `'e' + '́'.repeat(80)` |
| 4 | 1001 raw characters | `' '.repeat(996) + 'Elena'` (996 + 5 = 1001) |

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 2.4, E4, raw cap | BVA refuse side + EP on unit + raw cap | 1 parameterized ATC, 4 rows (one outcome: 422 too long) |

BVA detail: refuse edges 81 code points and 1001 raw are rows 1 and 4; 80 and 1000 accept edges are BK-2106 (1000 is OQ1). Row 4 uses 996 spaces plus a 5-letter name, as the TC corrected (the sprint row of 1000 spaces + "Elena" was 1005 raw).

## 7. Dependencies
- `DisplayNameSteps.openRoleSession('admin')`, `saveName`, `readStoredName`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Own name saved | Modify | `saveName(DataFactory.createDisplayName())` | each test (a fresh name generated and saved at the start of every row) | `release()` in `afterAll` restores the captured original |

## 9. Checklist
- [ ] Literal message; raw length of row 4 asserted by construction (`value.length === 1001`) in the test before sending
- [ ] Max 2 positional params
- [ ] Not duplicating an existing ATC (BK-2107 free)
- [ ] No comments in code
