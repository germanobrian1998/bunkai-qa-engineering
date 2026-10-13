# Measured Gotchas

> Loaded by: `business-api-context`, when reading this project's api map could mislead a competent session. Every row was measured on the date given against the source it names. Rows that stop being true move to §"No longer true"; they are never deleted. Proposed and applied per `agentic-qa-core/references/skill-refinement-protocol.md`.

## 1 · Reading the map

| # | Gotcha | Symptom | Fix | Measured | Verified against |
|---|---|---|---|---|---|
| 1 | `Idempotency-Key` is required, not optional, on `POST /tests`, `POST /runs`, `POST /test-plans/{id}/tests` and billing checkout | 400 `idempotency_key_required` on the first API test that omits it; reusing a key with another body gives 409 | Send a fresh `Idempotency-Key` header on every create of those four | 2026-10-12 | Handler code at product `origin/staging` 98ee1b4 (read, no live call); api map `error-semantics` |

## 2 · No longer true

_(empty)_
