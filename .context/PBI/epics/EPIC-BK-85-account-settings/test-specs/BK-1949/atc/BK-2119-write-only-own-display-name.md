# ATC Spec: BK-2119 — Write only the signed-in account

> Ticket: BK-2119 (TC20), Story BK-1949
> Component: DisplayNameApi, new
> Type: API — Negative / Security (mass assignment)
> Parent Story: BK-1949 (AC 4.1, E10, D4)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should write only the signed-in account name when the body names another user or extra fields given a cookie session | A user id or other identity field in the body changes nothing outside the caller | Two accounts with different names; B signed in and knows A's id | AC 4.1, E10 |

## 2. ATC Contract
```typescript
@atc('BK-2119')
async writeOnlyOwnDisplayName(args: {
  newName: string,
  extraFields: Record<string, unknown>,
  expectedEmail: string,
}): Promise<[APIResponse, DisplayNameResponse, DisplayNameBody & Record<string, unknown>]>
```
Fixed assertions (caller is B, Admin cookie):
- status 200, `body.display_name` equals `args.newName`
- read-back `GET /v1/me`: `user.display_name` equals `args.newName` and `user.email` equals `args.expectedEmail` (B keeps its own identity; the value comes from `config.roleUser('admin').email`, not from a response)

## 3A. API Details
Body is `{ display_name: newName, ...extraFields }`. The route reads only `display_name` and targets `principal.userId`. The extra-field payload is typed as `DisplayNameBody & Record<string, unknown>` in the component.

## 4. Assertions Split
### Fixed: section 2.
### Test-level (two identities)
- Member (A) cookie session `readStoredName()` equals A's literal prior name
- `idA` from Member `GET /v1/me` `user.id` before the call
- `release()` restores both accounts

## 5. Parameter table (literal, from the TC)
| # | extraFields |
|---|-------------|
| 1 | `{ user_id: idA }` |
| 2 | `{ user_id: idA, email: 'other.<4 letters>@example.com' }` |

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 4.1, E10 | Error guessing (mass assignment) + EP on extra-field class | 1 parameterized ATC, 2 rows (one outcome: 200, only B changes) |

## 7. Dependencies
- `DisplayNameSteps.openRoleSession('admin')` and `('member')`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| B and A with different saved names | Modify | `saveName` with two generated names | per test (arrange) | `release()` in `afterAll` restores both (originals via `capture()`) |
| `idA` | Discover | Member `GET /v1/me` | per test | none |

## 9. Checklist
- [ ] Second account is Member (exists), so the TC's "second QA account" note is resolved with no new account
- [ ] Max 2 positional params
- [ ] Not duplicating an existing ATC (BK-2119 free)
- [ ] No comments in code
