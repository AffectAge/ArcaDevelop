# Programming Standards

This is the day-to-day coding standard for Arcanorum agents. It applies to new and touched code. `docs/official-engineering-sources.md` records the primary sources behind these rules. Existing code may violate parts of this document; clean it only within an approved task scope.

## Code Organization

- Keep domain logic separate from UI, transport, persistence, filesystem, and third-party adapters.
- Follow `docs/folder-structure.md` when adding, moving, or splitting files/folders.
- Put mechanics rules in domain modules, not in route handlers or React components.
- Keep route handlers thin: parse/auth/validate, call services/domain logic, return normalized responses.
- Keep React components focused on presentation and user interaction, not server rules.
- Avoid catch-all `utils`, `helpers`, or `common` modules unless the file has a narrow named topic.
- Do not grow catch-all runtime files. New server code should move toward domain/service modules.

## Functions

- Each function should have one clear responsibility.
- Prefer pure functions for calculations, validation, scoring, and mechanics.
- Separate calculation, validation, mutation, persistence, and transport handling.
- Do not mix request validation, world mutation, database writes, and WS sending in one reusable function.
- Use `handle*` only for actual event, route, or UI handlers.
- Use `calculate*`, `validate*`, `normalize*`, `resolve*`, `apply*`, `build*`, `select*`, `derive*`, `load*`, and `persist*` according to `docs/naming-and-abstractions.md`.

## Abstractions

- Add abstractions only when they reduce real duplication or clarify ownership.
- Do not create generic frameworks for hypothetical future mechanics.
- If logic is reusable across mechanics, name it by stable domain responsibility, not by the first mechanic that uses it.
- If logic is truly feature-specific, keep the name specific.

## TypeScript And Types

- Keep strict TypeScript.
- Avoid `any`, `@ts-ignore`, broad casts, and type assertions that hide design problems.
- Casts are acceptable at boundaries such as Prisma JSON, external JSON files, DOM APIs, maplibre specs, and third-party library gaps.
- Raw external shapes use `Raw` or `Input` names.
- Validated domain values use clean domain names without `Raw`.
- Domain code should receive normalized typed values, not untrusted request/file data.

## Validation

- Validate data at boundaries: API, WS, scenario files, defines, AI config, localization, theme, uploads, and JSON imports.
- Prefer Zod or structured validators for new boundary code.
- Reject invalid scenario/gameplay data loudly; do not hide it behind gameplay fallback.
- Normalize once at the boundary, then keep domain logic typed and predictable.

## Errors

- API and WS boundaries return stable machine-readable error codes.
- Client maps error codes to localized text.
- Do not expose raw server messages or stack traces to players.
- Debug details must be permission-gated.
- Do not swallow errors with empty `catch` blocks or `console.log` only.

## Async And Concurrency

- Every mutating async flow must choose transaction, lock, queue, optimistic version, idempotency key, or explicit rejection.
- Do not let duplicate requests create duplicate orders, resources, files, events, or side effects.
- Avoid fire-and-forget work unless failures are observable and safe.
- Bound queues, retries, replay buffers, and caches.

## State

- The server is authoritative for game decisions.
- The client stores display state, request state, and derived state; it must not be trusted for permissions, costs, ownership, cooldowns, or legality.
- World state changes should flow through shared contracts and server-produced deltas.
- Avoid hidden local client state that can disagree with server truth without a resync path.

## Configuration

- Balance, pacing, rates, limits, costs, and AI bonuses belong in scenario defines.
- UI text belongs in localization.
- Theme values belong in scenario theme tokens.
- Permissions belong in permissions docs/config.
- Player-facing explanations belong in Arcawiki.
- Technical rationale belongs in docs and ADRs.

## Performance

- Do not add full-world scans in resolver, AI, WS, economy, market, map, or scenario hot paths without justification.
- Prefer indexes, batched queries, memoized derived data, bounded caches, and measured hot paths.
- Avoid N+1 database queries.
- Metrics, logs, queues, replay windows, and caches must be bounded.
- Report when performance-sensitive changes were not measured.

## Tests

- New mechanics need focused unit tests plus scenario/integration tests when behavior crosses systems.
- Write domain logic so it can be tested without HTTP, WS, DB, or UI when practical.
- Test behavior and invariants, not only implementation details.
- Add regression tests for bug fixes.
- Do not pretend missing test commands exist; add/propose them intentionally.

## Security

- Enforce authorization server-side.
- Validate and sanitize player/admin input.
- Keep secrets, JWTs, passwords, auth headers, cookies, and private player/admin data out of code, docs, and logs.
- Upload flows need type/size/dimension validation, ownership, scenario scope, and cleanup lifecycle.
- Dangerous admin operations need confirmation, audit, and dry-run/preview where practical.

## Frontend

- Use localization keys for visible text.
- Use scenario theme tokens for visual values.
- Preserve keyboard navigation, focus states, contrast, and readable sizes.
- Keep render logic readable; extract focused components/hooks when stateful UI grows.
- Avoid adding UI libraries without approval and dependency rationale.
- Map UI must avoid long main-thread work during pan/zoom.

## Backend

- Keep transport handlers thin.
- Put mechanics in domain modules and orchestration in services/runtime modules.
- Keep persistence access explicit and batch hot-path reads/writes.
- Use stable API/WS payloads and error codes.
- Add audit, permission, rate-limit, concurrency, and observability decisions for new mutations.

## Comments

- Comments should explain why, constraints, and non-obvious domain rules.
- Do not narrate obvious assignments.
- Leave notes for temporary or risky code, and mention them in the final report.

## Refactoring

- Opportunistic cleanup requires user confirmation.
- Do not hide behavior changes or balance changes inside refactors.
- When removing a mechanic, remove obsolete code, data, docs, tests, localization, Arcawiki entries, and assets.

## Forbidden Code Patterns

- Generic reusable names like `processData`, `handleStuff`, `doAction`, or `updateState`.
- Feature-specific names for broadly reusable domain utilities.
- Mixed concerns in one function.
- Hidden fallback/defaulting that masks invalid gameplay data.
- Hardcoded balance numbers, UI text, colors, permissions, or error text.
- Direct AI state mutation bypassing normal order validation.
- Client-only permission checks for privileged actions.
- Unbounded arrays/maps for logs, metrics, queues, replay, or caches.
- Empty `catch` blocks or `console.log`-only error handling.
- Tests that only lock implementation details while skipping domain behavior.
## Resource Ledger

Country-level resource mutations must go through the resource ledger. Mechanics and routes emit `ResourceFlow` entries with `resourceId`, `direction`, `amount`, `sourceType`, `sourceId`, `categoryId`, and `labelKey`; `ResourceLedgerRuntime` applies net totals to `worldBase.resourcesByCountry`.

Do not add direct gameplay writes such as `resources.science +=`, `resources.ducats =`, or `worldBase.resourcesByCountry[countryId].construction = ...` outside ledger runtime and world-state normalizers.
