# BK-1949: Settings | Choose the display name I go by

| Field | Value |
|-------|-------|
| **Priority** | P0 (BK-2100, BK-2101, BK-2117, BK-2118, BK-2119), P1 (BK-2105, BK-2106, BK-2107, BK-2122), P2 (BK-2134) |
| **Phase** | Standalone (ticket-driven regression automation of a Story already QA-tested, ATR BK-2138, signed off 2026-11-19) |
| **Items** | 10 TCs, 10 ATCs (one `@atc` per TC key, no multi-ATC test) |
| **Dependencies** | None on other tickets. The product code lives on `origin/staging` of `../upex-bunkai-tms` (the checked-out branch there does not have it yet) |
| **Requires** | Integration files: staging only (role accounts); e2e files also run on local. Owner session (`ui-setup`), Admin and Member cookie sessions (`role-sessions-setup`), `STAGING_USER_*`, `STAGING_ADMIN_*`, `STAGING_MEMBER_*`, `STAGING_VIEWER_*` set (by name, never by value). `bun run api:sync` before Code (the committed OpenAPI file has no `/me/display-name` and no `user.display_name` on `/me`) |
| **Source** | Story BK-1949 (Epic BK-85, Account & Settings), ATP BK-2137, ATS BK-2136, ATR BK-2138 |

## Summary

Automates the ten signed Candidate TCs that guard the display name a person chooses in Settings > Account: the set-and-greet UI flow (BK-2100, BK-2101, regression guard of BK-2244 in BK-2134) and the write contract of `PUT` / `DELETE /api/v1/me/display-name` (validation bounds, credential guard, own-account-only, lifecycle). Product facts were confirmed in code, read-only, at `origin/staging` of `../upex-bunkai-tms`: `lib/account/display-name.ts` (shared validator, copy, 80 code points, 1000 raw), `app/api/v1/me/display-name/route.ts` (`auth: 'cookie-only'`), `store.ts` (target is always `principal.userId`), `app/api/v1/me/route.ts` (`user.display_name`), `lib/home/welcome-summary.ts` (`welcomeGreeting`), `components/settings/{IdentityCard,DisplayNameForm}.tsx`, `components/home/WelcomeBanner.tsx` (test ids). Seven TCs are API-only, three drive the browser. The risk is HIGH by the ATP (auth, PAT, identity write).

## Test Cases

> Bodies live in Jira and are synced under the Story's `test-cases/` (all ten read, status Candidate). Gherkin Examples: `bun xray test get <KEY>`.

| TMS ID | Title (short) | Type | Priority | Level | Jira tags |
|--------|---------------|------|----------|-------|-----------|
| BK-2100 (TC1) | should save the name and show it next to the email, confirming "Your display name was saved." given an account with no name | Positive, UI | Critical | e2e | @critical @smoke @regression |
| BK-2101 (TC2) | should greet on Home with the full saved name as literal plain text (absorbs TC11 markup, email, URL rows) | Positive/Edge, UI | Critical | e2e | @critical @regression |
| BK-2134 (TC35) | should render an 80-character name readable without overflow in the identity card and the banner | Boundary, UI | Medium | e2e | @medium @regression |
| BK-2105 (TC6) | should refuse the save with "The display name cannot be empty." and keep the previous name when the value is blank after trimming | Negative, API | High | integration | @high @regression |
| BK-2106 (TC7) | should accept and store the name in full when it has 1 to 80 code points after trimming | Positive/Boundary, API | High | integration | @high @regression |
| BK-2107 (TC8) | should refuse the save with "The name must be at most 80 characters." when the value exceeds 80 code points or 1000 raw characters | Negative/Boundary, API | High | integration | @high @regression |
| BK-2117 (TC18) | should refuse the write with 401 "Authentication required." and write nothing with no cookie and no bearer | Negative, API | Critical | integration | @critical @regression |
| BK-2118 (TC19) | should refuse the write with 403 "Personal access tokens cannot change identity details. Use a browser session." for a PAT alone or with a cookie | Negative, API | Critical | integration | @critical @regression |
| BK-2119 (TC20) | should write only the signed-in account name when the body names another user or extra fields | Negative/Security, API | Critical | integration | @critical @regression |
| BK-2122 (TC23) | should answer 200 with the stored name and expose it in GET /me when written and removed | Positive/State, API | High | integration | @high @regression |

## Open follow-ups

- BVA accept edge at exactly 1000 raw characters has no signed TC; routed to /test-documentation.

## Out of scope (listed, not planned)

- BK-2104 (TC5): MANUAL by signed verdict (needs a real Google sign-in).
- The 25 Deferred READY Tests of ATS BK-2136, not planned here: BK-2102, BK-2103, BK-2108, BK-2109, BK-2110, BK-2111, BK-2112, BK-2113, BK-2114, BK-2115, BK-2116, BK-2120, BK-2121, BK-2123, BK-2124, BK-2125, BK-2126, BK-2127, BK-2128, BK-2129, BK-2130, BK-2131, BK-2132, BK-2133, BK-2135. BK-2110 (TC11) is absorbed as the markup, email and URL rows of BK-2101 at documentation time (its Jira note), not by this plan. BK-2115 and BK-2129 were also DEFERRED (execution) in the ATR (follow-ups BK-2245, BK-2246).
- No Test is created, edited or scored by this plan. Nothing here calls Jira.

## Technique per TC

| TC | Technique | Partitions / boundaries planned (all literal, from the TC) |
|----|-----------|------------------------------------------------------------|
| BK-2100 | EP + State Transition (no name to named) | One valid two-word generated name; account starts with no own name; field starts empty (D6) |
| BK-2101 | EP + Decision Table rule 1 (saved name beats provider name and email guess) | 5 rows: ordinary generated name, `<b>Elena</b>`, `<img src=x>`, `elena@example.com`, `https://example.com` (plain text, no element, no link) |
| BK-2134 | BVA (upper edge 80) x EP (no break opportunity vs with spaces) x viewport | 4 rows: `W` x 80 and `Elena ` repeated cut to 80, each at 1280 x 800 and 375 x 812 |
| BK-2105 | EP (every blank class) + ST (prior name saved vs none) + BVA lower edge 0 | 9 rows: 7 with a saved name (empty, 5 spaces, NBSP x 3, U+3000, U+200B x 3, U+2060 + U+FEFF, tab space newline), 2 with no name (empty, 5 spaces) |
| BK-2106 | BVA accept side (1, 79, 80) + EP on the length unit (code points) + trim-before-count | 6 rows: `E`, `A` x 79, `A` x 80, emoji x 80, `e` + U+0301 x 79 (80 code points), 3 spaces + `A` x 80 + 3 spaces |
| BK-2107 | BVA refuse side (81) + EP on the length unit + raw-input cap | 4 rows: `A` x 81, emoji x 81, `e` + U+0301 x 80 (81 code points), 996 spaces + 5-letter name (1001 raw) |
| BK-2117 | EP (credential class: none) x verb | 2 rows: PUT with a valid body, DELETE with no body |
| BK-2118 | Decision Table (credential x verb) | 4 rows: PAT alone and PAT + valid cookie, each on PUT and DELETE |
| BK-2119 | Error guessing (mass assignment) + EP on extra-field class | 2 rows: `user_id` of A; `user_id` of A + `email` |
| BK-2122 | State Transition (none, named, removed) | Single lifecycle: PUT, read, DELETE, read |

BVA coverage check against the Story's limits: length 0 (BK-2105), 1, 79, 80 (BK-2106), 81 (BK-2107), raw 1001 (BK-2107). The raw-cap accept edge (exactly 1000 raw characters) is in no signed TC: open question OQ1, not planned unless a row is added to BK-2106 by its owner.

## Test data classification (Discover / Modify / Generate)

| Data | Class | Source | Used by | Lifecycle |
|------|-------|--------|---------|-----------|
| Owner account (STAGING_USER) | Modify | `config.testUser`, cookie from `ui-setup` (`.auth/user.json`) | BK-2100, BK-2101, BK-2134 | Display name restored in `afterAll` |
| Admin account (actor B) and Member account (victim A) | Modify | `config.roleUser('admin' / 'member')`, cookie states from `role-sessions-setup` (`.auth/role-<role>.json`) | all seven integration TCs; Member only in BK-2119 | Display name restored in `afterAll` |
| Display name of each account (state) | Modify | `PUT` / `DELETE /v1/me/display-name` as arrange step, original read from `GET /v1/me` before | every TC | Restore the original in `afterAll` |
| Saved / new / other names (two-word, no trailing `. ! ?`) | Generate | New `DataFactory.createDisplayName()` (prefix `Kata`, faker surname plus 4 letters; never the email guess) | BK-2100, BK-2101 row 1, BK-2105 prior name, BK-2107 prior name, BK-2117, BK-2118, BK-2119, BK-2122 | None, the name is overwritten or restored |
| Boundary values (`A` x 80, emoji x 80, U+0301 chains, blank classes, 1001 raw) | Static literal | Row tables in the test files, built with `repeat` and `\u` escapes, never faker | BK-2105, BK-2106, BK-2107, BK-2134 | None |
| Markup, email, URL strings | Static literal | Row table in BK-2101 (`elena@example.com`, reserved domain) | BK-2101 | None |
| PAT (scopes `atc:read`, `atc:write`, `run:execute`, 1 day, name `kata-bk1949-fixture`) | Generate | `AuthApi.provisionToken` with the Admin cookie | BK-2118 | Revoke in `afterAll`; a revoked row stays in `access_tokens` (rows are never deleted, BK-572 precedent) |
| User id of A | Discover | `GET /v1/me` as Member, `user.id` | BK-2119 | Read only |

Credentials only through `@variables` (`config.testUser`, `config.roleUser`). No secret value is read, printed or written.

## Cleanup / restore strategy

The tests mutate profile state of shared accounts. Rules:

1. Each file captures the original display name of every account it writes in `beforeAll` (`GET /v1/me`, `user.display_name`, string or null) and restores it in `afterAll`: `PUT` the original when it is a string, `DELETE` when null. If the captured original matches the factory shape (`Kata ` prefix, a name leaked by an earlier failed run), `capture()` treats it as no name, so the restore `DELETE`s it and the leak self-heals. Every test that writes a non-factory value on a shared account (BK-2101 rows 2-5, BK-2106 rows, BK-2134 rows) ends on `DataFactory.createDisplayName()` through an `afterEach` that only saves (no assertions), so a leak is always a `Kata ` value. Residual: a crash between a literal write and that closing save leaves at worst one literal, which the next run captures as the original. A single `release()` restores every captured account first, then revokes the PAT, then disposes the contexts. Every restore and the PAT revoke are attempted independently; any error is thrown as one `AggregateError` after all were attempted, whether or not a test failed. Playwright reports an `afterAll` error separately from the test failure, so it does not mask it.
2. Every test arranges its own starting state (`DELETE` for "no name", `PUT` for a saved name), so a leaked name from an earlier failure cannot change the next test.
3. Account split removes cross-surface races within one run (`workers: 1`): e2e writes only the Owner; integration writes only Admin and Member, so the two surfaces never write the same account. Accepted risk: two concurrent pipelines on the same surface against staging (smoke-ui with a regression e2e on the Owner, or two refs' regression runs on Admin and Member) can race on one display name; run one suite per account at a time.
4. Integration files share Admin. `workers: 1` and `fullyParallel: false` (today's `playwright.config.ts`) keep in-file order; files declare no serial mode, so one failure does not hide the other TCs. Raising workers needs one account per concurrent file (risk R2).
5. PATs are revoked in `afterAll`. Nothing else is created, so there is nothing else to delete.

## Test-Design Checklist (test-design-doctrine Part 3)

| Line | Answer | Evidence |
|------|--------|----------|
| P1 risk beyond AC | YES | BK-2118 PAT plus cookie (E5), BK-2119 mass assignment (E10), BK-2105 invisible-only names (E3), BK-2107 raw cap (dev review fix), BK-2134 prior bug BK-2244 |
| P2 AC is the floor | YES | Code-point unit, combining marks, trim classes and credential combinations sit above the AC text |
| P3 concrete exploration | YES | Every row fixes the exact value, count and account state |
| P4 no AC collapsed | YES | AC 2.1 to 2.6 and E3, E4 split across BK-2105, BK-2106, BK-2107; AC 4.1 to 4.3 across BK-2117, BK-2118, BK-2119. The other Story TCs stay Deferred or Manual by signed decision, not by this plan |
| P5 anomaly cases | YES | Unicode (NBSP, U+3000, zero-width, BOM, combining), emoji units, 1001 raw, unknown body fields |
| EP | YES | Blank classes, accept units, credential classes, extra-field classes, name kinds (plain, markup, email, URL) |
| BVA | YES with one gap | 0, 1, 79, 80, 81 and raw 1001 planned. Raw 1000 accept edge unsigned: OQ1 |
| BVA-D | N/A | Nothing is rounded; trimming is the only transform and BK-2106 asserts it before the count |
| ST | YES | BK-2122 none, named, removed; BK-2105 prior name saved vs none. Invalid transitions (Remove with no name, same value again) belong to Deferred BK-2127, BK-2128 |
| DT | YES | BK-2118 credential x verb; BK-2101 fallback rule 1. Rules 2 to 4 of the fallback chain are Deferred BK-2114, BK-2113, BK-2115 |
| PW | N/A | No 3+ combinable factors beyond the BK-2118 table (2 x 2) |
| PARAM | YES | One parameterized ATC per TC; every Examples row is a literal table row looped in the test (outcome column where outcomes differ) |
| RISK | YES | P0 for credential guard and the greet flow; nothing dropped silently |
| OBS | YES | Every precondition is reachable on staging with existing accounts (no Google, no inbox). BK-2119 needs two accounts: Admin and Member exist |
| SEED | N/A | The greeting is produced through the real product path (PUT, then Home), not read from seeded state |

## Merged TCs

| Removed ID | Merged Into | Reason |
|------------|-------------|--------|
| (none by this plan) | | BK-2110 into BK-2101 was decided at documentation time (Jira Refinement Notes) |

## Updated TCs

None.

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R1 | A cookie-only route refuses any `Authorization: Bearer`, and `{ api }` and `{ test }` load the `api:login` PAT into the fixture | Every cookie write returns 403 | Writes go through `DisplayNameSteps`, which builds a fresh `ApiFixture` with no Bearer; the only Bearer is the BK-2118 PAT, set on purpose |
| R2 | Shared accounts; `workers > 1` or parallel CI jobs on the same account race on one profile | Flaky name assertions | Account split (e2e Owner, integration Admin and Member), `workers: 1`, per-test arrange |
| R3 | Committed OpenAPI lacks the route and `user.display_name` | Types missing, red `types:check` | `bun run api:sync` first (not run by this plan) |
| R4 | Sign-in throttle (10 per 60 s per source, ADR-0018) | 429 in setup | No spec signs in; the sessions come from the shared setups |
| R5 | Orphan revoked PAT rows per run | Table growth | Accepted, same as BK-572 and BK-225 |
| R6 | Staging deploy drifts from `origin/staging` code read here | Message or test-id mismatch | Literals come from the signed TCs and were checked against code; a mismatch is a product finding, not a plan change |
| R8 | BK-2117, BK-2118 and BK-2119 (`@critical`) are in no smoke project | No smoke signal for the credential guard | Deliberate: integration display-name specs are in `ROLE_SPECS`, hence `BASE_IGNORE`, so `smoke-api` (`@critical`) never sees them, and `smoke-roles-api` (`@smoke`) selects none; they run in `integration-roles` (regression). The e2e files run under `e2e` and `smoke-ui`, whose `@critical` grep picks BK-2100 and all five BK-2101 rows |
| R7 | Layout oracle (scroll width) depends on `break-words` and viewport | False failure after a CSS refactor | It is the BK-2244 regression guard; keep both viewports and both name shapes |

## Acceptance Criteria

- [ ] 10 TCs automated, each with its own `@atc('<TC key>')`, one method per key, no ATC calling another ATC
- [ ] Every Gherkin Examples row is a loop row of a parameterized test or ATC (outcome column where outcomes differ)
- [ ] Expected messages, codes and stored values are literals from the TC, never read back from the response under test
- [ ] No positional CSS selectors; locators by `data-testid`, role or label only
- [ ] No exact key-set assertions on whole response bodies; required fields only
- [ ] Original display names restored; PATs revoked
- [ ] No code comments except toolchain directives (Critical Rule #18)
- [ ] Tests pass on staging; `bun run types:check`, `bun run lint:check`, `bun run kata:manifest:check` clean
