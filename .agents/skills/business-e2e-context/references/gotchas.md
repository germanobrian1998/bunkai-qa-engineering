# Measured Gotchas

> Loaded by: `business-e2e-context`, when reading this project's e2e map could mislead a competent session. Every row was measured on the date given against the source it names. Rows that stop being true move to §"No longer true"; they are never deleted. Proposed and applied per `agentic-qa-core/references/skill-refinement-protocol.md`.

## 1 · Reading the map

| # | Gotcha | Symptom | Fix | Measured | Verified against |
|---|---|---|---|---|---|
| 1 | `/runs` and `/bugs` are not in the middleware's protected prefixes, and their pages have no redirect of their own | A "signed-out visitor is redirected to `/login`" test on these two routes passes or fails without proof of the real behaviour | Probe the signed-out behaviour in a browser first; do not assume the `/home`, `/projects`, `/atcs` redirect applies | 2026-11-17 | E2E map `journey-review-quality`, `discovery-gaps` (product `origin/staging` 4ccd8ede) |
| 2 | Whether a viewer can save a view is unknown (the API needs `atc:write` for writes) | A role-matrix test on saved views encodes a guess | Verify with a real viewer account before asserting allow or deny; no viewer account is declared yet (`persona-viewer`) | 2026-11-17 | E2E map `journey-use-saved-views`, `persona-viewer` (product `origin/staging` 4ccd8ede) |
| 3 | Open runs are aborted by inactivity sweeps: a human run after 4 hours with no mark, an agent or ci run after 60 minutes with no step report | An agent or ci run paused for an hour is silently aborted ("Inactivity timeout"), while a human-mode run seems to survive | Send a step report (or finish) within 60 minutes on agent or ci runs; choose the executor mode on purpose; never wait on a timeout inside a test | 2026-11-17 | E2E map `journey-execute-test-run`, `journey-automate-via-api` (product `origin/staging` 4ccd8ede) |
| 4 | A viewer does not see New ATC or New Test, but can still open `/atcs/new` and `/tests/new`; the save is refused by the database, not by the UI | A hidden-button test passes while the direct URL still renders the editor; the viewer's save-error text is unknown | Test viewer denial at both levels (button hidden, save refused) and do not assert a message until it is observed | 2026-11-17 | E2E map `overview`, `persona-viewer`, `discovery-gaps` (product `origin/staging` 4ccd8ede) |
| 5 | The e2e map was traced from code, not from a browser session | Journey steps, toasts and timings quoted from code can differ in the live app | Treat step text as a hypothesis; confirm it in a live session before encoding it in a selector or an assertion | 2026-11-17 | E2E map `discovery-gaps` (product `origin/staging` 4ccd8ede) |

## 2 · No longer true

_(empty)_
