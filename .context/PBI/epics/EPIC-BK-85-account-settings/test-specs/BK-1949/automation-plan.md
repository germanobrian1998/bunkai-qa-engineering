# Test Automation Plan: BK-1949

> Ticket: BK-1949 — Settings | Choose the display name I go by
> Type: e2e (3 TCs, UI with an API arrange) + integration (7 TCs, API only)
> Sprint: n/a (regression automation of a QA-tested Story)
> Created: 2026-11-22
> Status: proposed, waiting for the plan-to-code approval gate
> Code rule: no comments in code (Critical Rule #18). Only toolchain directives and one-line WHY a reader would get wrong. Endpoints, counts and test ids live in this plan and the atc/*.md files, not in the code.

## 1. Ticket Summary

- What to test: the ten signed Candidates BK-2100, BK-2101, BK-2134, BK-2105, BK-2106, BK-2107, BK-2117, BK-2118, BK-2119, BK-2122 (spec.md).
- Acceptance criteria covered: AC 1.1, 1.2 (BK-2100, BK-2101); AC 2.1 to 2.6 with E3, E4 (BK-2105, BK-2106, BK-2107); AC 2.7 (BK-2101, absorbs BK-2110); AC 4.1 to 4.3 with E5, E10 (BK-2117, BK-2118, BK-2119); D3, D5, D7 (BK-2122); edge 13 and prior bug BK-2244 (BK-2134).
- Endpoints under test (paths relative to `config.apiUrl`, which already ends in `/api`):
  - `PUT /v1/me/display-name` body `{ display_name: string }`; 200 `{ display_name: string }`; 400 `bad_request` "Request body must be valid JSON."; 401 `unauthorized` "Authentication required."; 403 `forbidden` "Personal access tokens cannot change identity details. Use a browser session."; 422 `validation_failed` with `details.field` = `display_name`.
  - `DELETE /v1/me/display-name` no body; 200 `{ display_name: null }`; 401; 403.
  - `GET /v1/me` (read-back): `user.display_name` string or null (not in the committed OpenAPI yet).
- Messages (literals, each ends with a period): empty "The display name cannot be empty."; too long "The name must be at most 80 characters."; saved "Your display name was saved.".
- Confirmed in code (`origin/staging`, read-only): route `auth: 'cookie-only'`, bearer header wins over the cookie (`resolveIdentity`), so a PAT plus cookie is refused; any `Authorization: Bearer` is treated as a PAT, so a cookie write must carry none. Validator: trim `\s` plus U+200B..U+200D, U+2060 at both ends, then forbidden characters, then `[...value].length` <= 80; raw `length` > 1000 is refused first with the too-long message (UTF-16 units). Target is always `principal.userId`; only `display_name` is read from the body.
- Screens under test: `/settings/account` (identity card, display name form) and `/home` (welcome banner). Test ids confirmed in product code: `identity-card`, `identity-display-name`, `identity-email`, `display-name-form`, `display-name-input`, `display-name-save`, `display-name-error`, `home-welcome-banner`, `home-welcome-greeting`. The success toast has no test id (sonner), so it is located by its visible text.
- Types: `bun run api:sync` is a Code-time prerequisite (the committed `api/openapi.json` has neither the route nor `user.display_name`). New facade `api/schemas/account.types.ts` (+ export in `api/schemas/index.ts`). Not run by this plan.
- Dependencies (other tickets): none.

## 2. Architecture Decisions

> ADR promotion check (adr-doctrine section 1): D2 (account-level state isolation by surface) is a candidate; see section 8. Everything else is ticket-local.

### Component Strategy

Manifest check (`kata-manifest.json`, generated 2026-11-21): api ActivityApi, AuthApi, BugApi, InviteApi, RunsApi, WorkspaceApi; ui LoginPage, MembersPage, RunsReportPage; steps listing MemberRemovalSteps and RunFixtureSteps (steps are not in the manifest `components` keys). None of `DisplayNameApi`, `AccountPage`, `DisplayNameSteps` exists. None of the ten ATC ids exists in `atcs[].id` (existing: BK-311, BK-312, BK-313, BK-314, BK-1656, BK-1657, BK-1664, BK-1665, BK-1963, BK-1967, BK-1974, BK-1975, BK-1982, BK-1983, BK-1992). The manifest forbids two methods with one `@atc` id, so there is exactly one method per TC key.

| Decision | Value | Rationale |
|----------|-------|-----------|
| D1 Components | New: `DisplayNameApi` (resource `/v1/me/display-name`: 7 ATCs plus 3 `@step` helpers), `AccountPage` (UI, 3 ATCs), `DisplayNameSteps` (Steps). Reused unchanged: `AuthApi.provisionToken` (its `name` argument is already optional) and `AuthApi.revokeToken` for the BK-2118 PAT. `AuthApi.getCurrentUser` is not reused inside `DisplayNameApi` (components do not depend on components); a private `readStoredName` step reads `/v1/me`. No `MeApi` | One component per resource (KATA layer 3); `/me` identity probe stays owned by `AuthApi` |
| D2 Cookie sessions | Integration: Admin (actor B, all files) and Member (victim A, BK-2119 only) cookie sessions from `.auth/role-<role>.json`, opened by `DisplayNameSteps.openRoleSession`. E2E: Owner `.auth/user.json` through the browser context, in the plain `e2e` and `smoke-ui` projects (no config change for the e2e half) | ADR-0018: no spec signs in on its own; the shared setups sign each role in once |
| D3 playwright.config.ts edit | Add the integration path `**/integration/**/account/display-name/**/*.test.ts` to the matchers of `integration-roles` and to `ROLE_SPECS`, hence `BASE_IGNORE`: plain `integration` and `smoke-api` (grep `@critical`) never see these specs, and `smoke-roles-api` (grep `@smoke`) selects none of them because its matcher does not list the path (none of the integration TCs carries `@smoke`). BK-2117, BK-2118 and BK-2119 therefore run only in `integration-roles` (regression). The e2e files run under `e2e` and `smoke-ui`, where the `@critical` grep picks BK-2100 and all five BK-2101 rows. Part of the first implementation commit. Integration files: staging only (role accounts). Fallback if the edit is refused: sign in once per file with `AuthApi.signInForSession` in `beforeAll` (breaks ADR-0018 point 1 for 4 files, costs 2 sign-ins each) | A plain integration run has no cookie session and the `api:login` PAT is refused by a cookie-only route |
| D4 Arrange without ATCs | Preconditions ("name saved", "no name") are `@step` helpers `saveName`, `removeName`, `readStoredName` on `DisplayNameApi`, driven by `DisplayNameSteps`. They are not `BK-2122`. TC bodies say "arrange step BK-2122", but that ATC ends in the removed state and a Steps chain may not re-run it per test without recording BK-2122 results in unrelated runs | Keeps `ATCs do not call ATCs`, keeps one result per TC key |
| D5 No Bearer on cookie writes | `DisplayNameSteps` builds its own `ApiFixture` from `{ request }` (integration, through `playwright.request.newContext`) or `{ page }` (e2e, `forBrowser(page)`) and never calls `setAuthToken`. `{ api }` and `{ test }` fixtures load the `api:login` PAT, so they are not used for writes. Anonymous caller for BK-2117 = a new request context, no cookie, no Bearer. PAT-alone caller for BK-2118 = new context plus `setAuthToken(pat)`; PAT-plus-cookie = Admin cookie context plus `setAuthToken(pat)` | `resolveIdentity` takes the bearer first; any Bearer means PAT |
| D6 Verification split | Inside an ATC: status, error code, literal message, `details.field`, stored-name read-back through the SAME caller when it has a session. Test-level: any read-back by another identity (BK-2117, BK-2118 read back with the Admin cookie; BK-2119 reads A with the Member cookie), restore, PAT lifecycle | An ATC has one caller identity |
| D7 Expected values | Always literals from the TC (`'The name must be at most 80 characters.'`, row tables), never taken from the response under test. Stored-value expectations are passed in as `expectedStored` | Lying-test guard (lesson of the BK-225 review) |
| D8 Locators | By `data-testid`, role or label only; no `nth-child`, no counts of svg. Toast by text. "No element rendered from the name" = `locator('b, img, a')` count 0 inside the greeting and the name element (tag selectors, not positions) | Lesson of the BK-225 review |
| D9 Assertions on bodies | Required fields only (`display_name`, `error.code`, `error.message`, `error.details.field`); never `Object.keys(body)` equality | Lesson of the BK-225 review |
| Fixture | Integration: `{ api }` is NOT used; files take `{ playwright }` in `beforeAll` and build callers through `DisplayNameSteps` (same as BK-225 and BK-572). E2E: `{ test }` + `playwright` in `beforeAll` (UI ATCs through `test.ui.account`; arrange through `steps.forBrowser(test.page)`) | Fixture selection rule: UI action + API arrange = hybrid `{ test }` |
| Waits | `interceptResponse` / `waitForApiResponse` around the Save click to await the PUT; `expect(locator)` web-first for toast and text; no `waitForTimeout` | Conditions, never timeouts |
| Params | Max 2 positional parameters; 3 or more in an object; import aliases only (`@api/...`, `@ui/...`, `@steps/...`, `@schemas/...`, `@data/...`, `@variables`, `@TestFixture`) | typescript-patterns sections 1 and 8 |

### [E2E ONLY] UI Elements (`AccountPage`, routes `/settings/account` and `/home`)

Locators inline in the ATC; promote to a `private readonly` arrow only when a second ATC uses the same locator (`identityName` and `greeting` are used by two ATCs each, so they become shared arrows at Code time).

| Element | Locator Strategy | Locator Value |
|---------|------------------|---------------|
| Identity card | testid | `identity-card` |
| Name on the card | testid | `identity-display-name` (class `break-words`) |
| Email on the card | testid | `identity-email` |
| Display name form | testid | `display-name-form` |
| Display name input | testid (also label "Display name") | `display-name-input` |
| Save button | testid (role button "Save") | `display-name-save` |
| Success toast | text | "Your display name was saved." |
| Home banner | testid | `home-welcome-banner` |
| Greeting heading | testid | `home-welcome-greeting` |
| Markup guard | tag selectors inside the two name elements | `b, img, a` (count 0) |

### [INTEGRATION ONLY] API Details

| Aspect | Value |
|--------|-------|
| Endpoint(s) | Under test: `PUT` and `DELETE /v1/me/display-name`. Setup and read-back: `GET /v1/me`, `POST /v1/tokens` and `DELETE /v1/tokens/{id}` (PAT, through `AuthApi`) |
| OpenAPI Type(s) | `DisplayNameBody`, `DisplayNameResponse`, `MeResponse` (with `user.display_name`), `CreateTokenBody`, `CreateTokenResponse`, `ErrorEnvelope`; facade `api/schemas/account.types.ts` re-exporting the first three, `ErrorEnvelope` from `@schemas/workspace.types` |
| Auth Required | Yes, cookie session only. Admin cookie (actor), Member cookie (victim), no credential (BK-2117), PAT (BK-2118) |
| Return Pattern | PUT: `[APIResponse, TBody, TPayload]`; DELETE: `[APIResponse, TBody]`; UI ATCs return `void` |

## 3. ATC Registry

### Existing ATCs (Reuse)

| ATC ID | Component | Method | Description |
|--------|-----------|--------|-------------|
| (none) | | | No existing ATC covers the display name. Reused as setup helpers only: `AuthApi.provisionToken`, `AuthApi.revokeToken` (manifest: AuthApi, helpers without `@atc`) and the `playwright` request contexts |

### New ATCs (Create)

| ATC ID | Component | Method | Description | Complexity | Contract file |
|--------|-----------|--------|-------------|------------|---------------|
| BK-2100 | `AccountPage` (UI) | `saveDisplayNameSuccessfully(args: { name: string, email: string })` | Open Settings > Account; field empty; type name; Save; toast literal; card shows name and email | Simple | plan only |
| BK-2101 | `AccountPage` (UI) | `greetWithSavedName(args: { savedName: string, greeting: string })` | Open Home; greeting equals literal; no element or link inside; open Settings; card shows the same literal | Medium (5 rows) | atc/BK-2101 |
| BK-2134 | `AccountPage` (UI) | `renderLongDisplayName(args: { name: string, viewport: { width: number, height: number } })` | Set viewport; Settings then Home; whole name shown; contained in card and banner; no horizontal scroll | Complex (geometry, 4 rows) | atc/BK-2134 |
| BK-2105 | `DisplayNameApi` | `refuseBlankDisplayName(args: { value: string, unchangedName: string \| null })` | PUT blank value; 422 `validation_failed`, empty message literal, `details.field`; read-back equals `unchangedName` | Medium (9 rows) | atc/BK-2105 |
| BK-2106 | `DisplayNameApi` | `saveDisplayNameWithinBounds(args: { value: string, expectedStored: string })` | PUT value; 200; body and `/me` equal `expectedStored` | Complex (BVA, 6 rows) | atc/BK-2106 |
| BK-2107 | `DisplayNameApi` | `refuseTooLongDisplayName(args: { value: string, unchangedName: string })` | PUT value; 422, too-long literal, `details.field`; read-back equals `unchangedName` | Complex (BVA, 4 rows) | atc/BK-2107 |
| BK-2117 | `DisplayNameApi` | `refuseWriteWithoutCredentials(args: { verb: 'PUT' \| 'DELETE', displayName?: string })` | Anonymous caller; 401 `unauthorized`, "Authentication required." | Simple (2 rows) | plan only |
| BK-2118 | `DisplayNameApi` | `refuseWriteWithPersonalAccessToken(args: { verb: 'PUT' \| 'DELETE', displayName?: string })` | Caller holding a PAT (alone or with cookie); 403 `forbidden`, literal message | Medium (4 rows) | atc/BK-2118 |
| BK-2119 | `DisplayNameApi` | `writeOnlyOwnDisplayName(args: { newName: string, extraFields: Record<string, unknown>, expectedEmail: string })` | B PUTs name plus extra fields; 200 body equals `newName`; `/me` as B shows `newName` and B's email | Complex (two identities) | atc/BK-2119 |
| BK-2122 | `DisplayNameApi` | `writeAndRemoveDisplayNameSuccessfully(args: { newName: string })` | PUT, read-back, DELETE, read-back | Medium (lifecycle) | atc/BK-2122 |

Convention note: BK-2105, BK-2106, BK-2107, BK-2117, BK-2118, BK-2119, BK-2101 and BK-2134 each carry several Examples rows with one outcome class per TC, so each is ONE method looped over a literal row table (rule 3). BK-2105 is the only TC whose rows differ in the precondition (prior name saved vs none) with the same outcome; it stays one method with `unchangedName` as the discriminator.

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|-----------|--------|---------|-------------|
| `DisplayNameApi` | `saveName(name: string)` | `[APIResponse, DisplayNameResponse]` | `PUT`, asserts 200 only; arrange and restore |
| `DisplayNameApi` | `removeName()` | `[APIResponse, DisplayNameResponse]` | `DELETE`, asserts 200 only; arrange and restore |
| `DisplayNameApi` | `readStoredName()` | `string \| null` | `GET /v1/me`, returns `user.display_name`; discovery, read-back and A's name in BK-2119 |
| `AccountPage` | `gotoSettings()` | `void` | Navigation (`@step`), used before the ATCs; Home is opened by the private `openHome` inside the ATCs |
| `DisplayNameSteps` | `openRoleSession(role)`, `openOwnerBrowserSession()`, `openAnonymous()`, `openBearerOnly(token)`, `openCookieWithBearer({ role, token })` | `{ api: ApiFixture }` | New request contexts per credential shape (no Bearer unless the method says so) |
| `DisplayNameSteps` | `forBrowser(page)` | `ApiFixture` | Same page and cookies as the browser, no Bearer (e2e arrange) |
| `DisplayNameSteps` | `capture(api)`, `release()` | `string \| null` / `void` | `capture` reads the original name (a factory-shaped `Kata ` leak counts as null); `release` restores every captured account (PUT or DELETE), then revokes the PAT, then disposes contexts, and throws one `AggregateError`; rethrow rule in spec.md |
| `DisplayNameSteps` | `mintPat(issuer)` | `CreateTokenResponse` | Wraps `AuthApi.provisionToken` (name `kata-bk1949-fixture`) with the existing Admin session passed in; the revoke happens inside `release()` |

## 4. Test Data Strategy

| Data | Source | Lifecycle |
|------|--------|-----------|
| Owner (e2e), Admin (B), Member (A) | Modify (display name only): `config.testUser`, `config.roleUser('admin' / 'member')`; cookie states from the shared setups | Display name restored by `release()` in `afterAll` |
| Account display name | Modify: `saveName` / `removeName`, original captured first | Restored in `afterAll` |
| Names (saved, new, other) | Generate: `DataFactory.createDisplayName()` | Overwritten or restored |
| Boundary and blank values | Static literals in the row tables | None |
| PAT | Generate: `provisionToken` (Admin cookie, scopes `atc:read`, `atc:write`, `run:execute`, 1 day) | Revoked by `release()` in `afterAll` |
| User id of A | Discover: `GET /v1/me` as Member | Read only |

### DataFactory additions / Constants additions

`tests/data/DataFactory.ts`: `static createDisplayName(): string` returns `Kata <surname> <4 letters>`; 1 to 80 code points, no control or trailing sentence punctuation, never the email guess.

`tests/data/constants.ts`: `DISPLAY_NAME_MESSAGES` = `{ empty: 'The display name cannot be empty.', tooLong: 'The name must be at most 80 characters.', saved: 'Your display name was saved.', unauthenticated: 'Authentication required.', patForbidden: 'Personal access tokens cannot change identity details. Use a browser session.' }`, `DISPLAY_NAME_VIEWPORTS = { desktop: { width: 1280, height: 800 }, mobile: { width: 375, height: 812 } }`. `tests/data/types.ts`: `DisplayNameRole = 'admin' | 'member'` only if needed.

## 5. Test Scenarios

Playwright runs files alphabetically with `workers: 1`; no test depends on another (each arranges its own state). Implementation order is in section 6.

### File: tests/e2e/account/display-name/saveDisplayName.test.ts
Fixture: `{ test }` + `playwright` (in `beforeAll`). Project: `e2e` (and `smoke-ui` for the `@critical` tag).

#### Scenario 1: set a name from Settings (BK-2100)
Test: "BK-2100: should save the name and show it next to the email, confirming 'Your display name was saved.' when the account has no own name"
Preconditions (inside the test body): `removeName()` through `DisplayNameSteps.forBrowser(page)`; `beforeAll` captures the original.
ATCs called: `ui.account.saveDisplayNameSuccessfully({ name, email: config.testUser.email })`, name from `DataFactory.createDisplayName()`.
Test-level assertions: `readStoredName()` equals the typed name (the TC's `GET /api/v1/me` check).
Teardown: `afterAll` restore.

### File: tests/e2e/account/display-name/greetWithDisplayName.test.ts
Fixture: `{ test }` + `playwright` (in `beforeAll`). Project: `e2e`, `smoke-ui` (`@critical`).

#### Scenario 1..5: one parameterized test over the Examples table (BK-2101)

| row | savedName | greeting (literal) |
|-----|-----------|--------------------|
| ordinary | generated `Kata Xxxx Abcd` | `Welcome back, ` + the same string + `.` |
| markup bold | `<b>Elena</b>` | `Welcome back, <b>Elena</b>.` |
| markup img | `<img src=x>` | `Welcome back, <img src=x>.` |
| email | `elena@example.com` | `Welcome back, elena@example.com.` |
| URL | `https://example.com` | `Welcome back, https://example.com.` |

Test: "BK-2101: should greet on Home with the full saved name as literal plain text when a display name is saved" (loop over 5 rows; the generated row's literal is built in the test from the generated name, not read from the page)
Preconditions: `saveName(savedName)` per row.
ATCs called: `ui.account.greetWithSavedName({ savedName, greeting })` per row.
Teardown: `afterEach` saves `DataFactory.createDisplayName()` (no assertions); `afterAll` restore.

### File: tests/e2e/account/display-name/renderLongDisplayName.test.ts
Fixture: `{ test }` + `playwright` (in `beforeAll`). Project: `e2e`.

#### Scenario 1..4: 80-character name at two viewports (BK-2134)

| row | name | viewport |
|-----|------|----------|
| no break opportunity, desktop | `'W'.repeat(80)` | 1280 x 800 |
| no break opportunity, mobile | `'W'.repeat(80)` | 375 x 812 |
| with spaces, desktop | `'Elena '.repeat(14).slice(0, 80)` (ends on `El`, no trailing space) | 1280 x 800 |
| with spaces, mobile | same | 375 x 812 |

Test: "BK-2134: should render an 80-character name readable without overflow in the identity card and the banner when the longest accepted name is saved"
Preconditions: `saveName(name)` per row.
ATCs called: `ui.account.renderLongDisplayName({ name, viewport })` per row.
Teardown: `afterEach` saves `DataFactory.createDisplayName()` (no assertions); `afterAll` restore.

### File: tests/integration/account/display-name/guardDisplayNameWrite.test.ts
Fixture: `{ playwright }` + `DisplayNameSteps`. Project: `integration-roles` (staging only).

#### Scenario 1: anonymous write (BK-2117)
Test: "BK-2117: should refuse the write with 401 'Authentication required.' and write nothing when the request carries no cookie and no bearer token" (2 rows: PUT with a generated other name, DELETE).
Preconditions: Admin session `saveName(savedName)`.
ATCs called: `anonymous.displayName.refuseWriteWithoutCredentials({ verb, displayName })` per row.
Test-level assertions: Admin `readStoredName()` equals `savedName` after each row.

#### Scenario 2: PAT (BK-2118)
Test: "BK-2118: should refuse the write with 403 'Personal access tokens cannot change identity details. Use a browser session.' when the request carries a personal access token" (4 rows: PAT alone x PUT, DELETE; PAT + cookie x PUT, DELETE).
Preconditions: per test, Admin session `saveName(savedName)`; `mintPat(admin)` once in `beforeAll`.
ATCs called: `bearerOnly.displayName.refuseWriteWithPersonalAccessToken(...)` or `cookieWithBearer.displayName....` per row; PUT body is a valid generated name so the refusal cannot come from validation.
Test-level assertions: Admin `readStoredName()` equals `savedName`.
Teardown: `release()` (restore, then revoke the PAT).

#### Scenario 3: only the signed-in account (BK-2119)
Test: "BK-2119: should write only the signed-in account name when the body names another user or extra fields given a cookie session" (2 rows).
Preconditions: per test, Admin (B) and Member (A) each `saveName` with different generated names; `idA` from Member `GET /v1/me` `user.id`.
ATCs called: `admin.displayName.writeOnlyOwnDisplayName({ newName, extraFields, expectedEmail: config.roleUser('admin').email })` per row; rows `{ user_id: idA }` and `{ user_id: idA, email: config.roleUser('member').email }` (Member's own email with Member's id).
Test-level assertions: Member `readStoredName()` equals `nameA`; Admin `GET /me` email still equals `config.roleUser('admin').email`.
Teardown: `release()` restores both accounts.

### File: tests/integration/account/display-name/refuseInvalidDisplayName.test.ts
Fixture: `{ playwright }` + `DisplayNameSteps`. Project: `integration-roles`.

#### Scenario 1: blank values (BK-2105)
Test: "BK-2105: should refuse the save with 'The display name cannot be empty.' and keep the previous name when the value is blank after trimming" (9 rows, table in atc/BK-2105).
Preconditions per row: `saveName(prior)` or `removeName()` for the no-name rows.
ATCs called: `admin.displayName.refuseBlankDisplayName({ value, unchangedName })`.

#### Scenario 2: over-limit values (BK-2107)
Test: "BK-2107: should refuse the save with 'The name must be at most 80 characters.' and keep the previous name when the value exceeds 80 code points or 1000 raw characters" (4 rows, table in atc/BK-2107).
Preconditions: `saveName(savedName)`.
ATCs called: `admin.displayName.refuseTooLongDisplayName({ value, unchangedName: savedName })`.
Teardown: restore.

### File: tests/integration/account/display-name/saveDisplayName.test.ts
Fixture: `{ playwright }` + `DisplayNameSteps`. Project: `integration-roles`.

#### Scenario 1..6: accepted values (BK-2106)
Test: "BK-2106: should accept and store the name in full when it has 1 to 80 code points after trimming" (6 rows, table in atc/BK-2106).
Preconditions: per row, `saveName(DataFactory.createDisplayName())` so the read-back must change (a value equal to the prior one would pass without a write).
ATCs called: `admin.displayName.saveDisplayNameWithinBounds({ value, expectedStored })`.
Teardown: `afterEach` saves `DataFactory.createDisplayName()` (no assertions); `afterAll` restore.

### File: tests/integration/account/display-name/writeAndRemoveDisplayName.test.ts
Fixture: `{ playwright }` + `DisplayNameSteps`. Project: `integration-roles`.

#### Scenario 1: lifecycle (BK-2122)
Test: "BK-2122: should answer 200 with the stored name and expose it in GET /me when the name is written and removed through the API given a cookie session"
Preconditions: Admin session; original captured.
ATCs called: `admin.displayName.writeAndRemoveDisplayNameSuccessfully({ newName })`.
Teardown: restore (the ATC ends in the removed state; restore puts the original back).

## 6. Implementation Order

- [ ] `bun run api:sync`; add `api/schemas/account.types.ts` and its export in `api/schemas/index.ts`
- [ ] Add `DataFactory.createDisplayName` and the constants (section 4)
- [ ] Edit `playwright.config.ts` (D3), first commit with the first integration file
- [ ] Create `DisplayNameApi` (helpers first, then BK-2122 ATC), register `displayName` in `ApiFixture` (constructor and both token-propagation overrides)
- [ ] Create `DisplayNameSteps`
- [ ] `writeAndRemoveDisplayName.test.ts` (validates the write path every other file arranges with)
- [ ] `saveDisplayName.test.ts` (BK-2106), `refuseInvalidDisplayName.test.ts` (BK-2105, BK-2107)
- [ ] `guardDisplayNameWrite.test.ts` (BK-2117, BK-2118, BK-2119)
- [ ] Create `AccountPage`, register `account` in `UiFixture`
- [ ] The three e2e files
- [ ] `bun run kata:manifest`, `types:check`, `lint:check`; run staging projects `e2e`, `integration-roles`
- [ ] TMS: each TC moves to Pull Request on PR open (never Automated before merge)

## 7. Success Criteria

- [ ] All ACs of the ten TCs covered (floor), plus the beyond-AC rows in spec.md (blank classes, combining marks, PAT plus cookie, mass assignment)
- [ ] BVA rows at 0/1, 79/80/81 and raw 1001 automated; raw 1000 accept edge pending OQ1
- [ ] KATA compliance: one `@atc` per key, no ATC calling an ATC, no positional CSS, no whole-body key-set asserts
- [ ] Fixture correct (no `{ api }` for cookie writes), aliases used, no hardcoded waits
- [ ] Original names restored, PAT revoked
- [ ] Tests pass on staging; `kata:manifest:check` clean

## 8. ADR candidate

D2 plus the restore contract: "Account-level profile state is isolated by account, not by data: e2e owns the Owner, integration owns Admin and Member; every writer captures and restores the original." Hard to reverse once suites rely on it, surprising without context (ADR-0010 says isolate by data, which is impossible for a single profile field), a real trade-off (extra role-session routing vs per-file sign-in). Promote as a Proposed ADR at Code time; the human approves.

See ADR-0030 (`.context/ADR/ADR-0030-account-state-isolation-by-account.md`, Proposed).
