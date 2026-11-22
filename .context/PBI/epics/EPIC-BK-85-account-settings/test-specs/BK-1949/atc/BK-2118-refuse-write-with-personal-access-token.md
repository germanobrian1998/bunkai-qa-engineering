# ATC Spec: BK-2118 — Refuse the write with a personal access token

> Ticket: BK-2118 (TC19), Story BK-1949
> Component: DisplayNameApi, new
> Type: API — Negative / Security
> Parent Story: BK-1949 (AC 4.3, E5, D3)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should refuse the write with 403 "Personal access tokens cannot change identity details. Use a browser session." when the request carries a personal access token | A PAT, alone or together with a valid cookie, never writes identity | Admin own name saved; PAT with `atc:read`, `atc:write`, `run:execute` | AC 4.3, E5 |

## 2. ATC Contract
```typescript
@atc('BK-2118')
async refuseWriteWithPersonalAccessToken(args: {
  verb: 'PUT' | 'DELETE',
  displayName?: string,
}): Promise<[APIResponse, ErrorEnvelope]>
```
The instance already carries the credentials (set by the caller through `DisplayNameSteps`): Bearer only, or Bearer plus cookie context.
Fixed assertions:
- status 403, `error.code` `forbidden`
- `error.message` equals the literal `Personal access tokens cannot change identity details. Use a browser session.`

## 3A. API Details
`PUT` / `DELETE /v1/me/display-name`. The gateway refuses `via: 'bearer'` before the body runs, so a valid PUT body is sent to prove the refusal is not validation. The bearer header wins over the cookie in `resolveIdentity`.

## 4. Assertions Split
### Fixed: section 2.
### Test-level
- Admin cookie session `readStoredName()` equals the saved literal name after every row
- PAT `kata-bk1949-fixture` minted in `beforeAll` (`mintPat(admin)`, with the existing Admin session), revoked by `release()` in `afterAll`

## 5. Parameter table (literal, from the TC)
| # | verb | credentials |
|---|------|-------------|
| 1 | PUT | Bearer PAT only |
| 2 | DELETE | Bearer PAT only |
| 3 | PUT | Bearer PAT + Admin cookie |
| 4 | DELETE | Bearer PAT + Admin cookie |

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 4.3, E5 | Decision Table (credential x verb) | 1 parameterized ATC, 4 rows (one outcome: 403) |

## 7. Dependencies
- `DisplayNameSteps.openBearerOnly`, `openCookieWithBearer`, `mintPat(issuer)`, `release()`, `openRoleSession('admin')`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| PAT, 1 day, 3 scopes | Generate | `AuthApi.provisionToken` (Admin cookie) | `beforeAll` | `release()` revokes in `afterAll` |
| Own name saved | Modify | `saveName` | per test (arrange) | `release()` restores in `afterAll` |

## 9. Checklist
- [ ] The PAT never appears in logs (`redactKeys` already on `provisionToken`)
- [ ] Max 2 positional params
- [ ] Not duplicating an existing ATC (BK-2118 free)
- [ ] No comments in code
