# ATC Spec: BK-2122 — Write and remove the name through the API

> Ticket: BK-2122 (TC23), Story BK-1949
> Component: DisplayNameApi, new
> Type: API — Positive / State
> Parent Story: BK-1949 (D3, D5, D7, AC 1.1)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should answer 200 with the stored name and expose it in GET /me when the name is written and removed through the API given a cookie session | Full lifecycle of the write contract and the `/me` exposure | Admin cookie session | D3, D5, AC 1.1 |

## 2. ATC Contract
```typescript
@atc('BK-2122')
async writeAndRemoveDisplayNameSuccessfully(args: {
  newName: string,
}): Promise<[APIResponse, DisplayNameResponse]>
```
Fixed assertions, in order:
- PUT `{ display_name: newName }`: 200, `body.display_name` equals `newName`
- `GET /v1/me`: `user.display_name` equals `newName`
- DELETE: 200, `body.display_name` is `null`
- `GET /v1/me`: `user.display_name` is `null`

## 3A. API Details
`PUT` then `DELETE /v1/me/display-name`; read-backs through the private `readStoredName` helper (not an ATC). Returns the DELETE response.

## 4. Assertions Split
### Fixed: section 2.
### Test-level
- none beyond restore: the ATC ends in the removed state, so `afterAll` puts the original name back

## 5. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| D3, D5, D7 | State Transition (none, named, removed) | 1 ATC, single lifecycle, no rows |

Idempotency (same value twice, remove with nothing saved) is Deferred BK-2127 and BK-2128, not planned here.

## 6. Dependencies
- `DisplayNameSteps.openRoleSession('admin')`; its arrange helpers are `@step`s on the same component, not this ATC (plan D4)

## 7. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Name overwritten then removed | Modify | the ATC | test | restore original in `afterAll` |

## 8. Checklist
- [ ] No ATC called from another ATC or from Steps
- [ ] Max 2 positional params
- [ ] Not duplicating an existing ATC (BK-2122 free)
- [ ] No comments in code
