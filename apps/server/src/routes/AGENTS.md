# Server routes guide

Always start from root `AGENTS.md` and `docs/README.md`.

Routes are thin boundaries: receive dependencies, authenticate/authorize, validate/normalize input, call owning mechanics/runtime/persistence services, and return typed stable results.

Do not own gameplay rules, persistence schemas, scenario formats, cross-route state, or raw upload paths here. Mutations require stable errors plus explicit concurrency, idempotency, audit, rate-limit, and cleanup decisions.
