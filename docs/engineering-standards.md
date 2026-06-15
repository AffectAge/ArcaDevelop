# Engineering Standards

For day-to-day coding rules, use `docs/programming-standards.md` as the canonical standard. This document is the short engineering overview.

## General Code Standards

- Keep domain logic separate from transport, UI, persistence, and file-system boundaries.
- Validate data at boundaries; pass normalized typed values into domain code.
- Prefer explicit names over clever abstractions.
- Follow `docs/programming-standards.md` for code organization, functions, async/concurrency, state, validation, tests, frontend/backend standards, and forbidden code patterns.
- Follow `docs/naming-and-abstractions.md` for function/type/module names.
- Add abstractions only when they reduce real duplication or clarify domain boundaries.
- Keep modules organized by responsibility; do not grow catch-all runtime files.
- Avoid unrelated refactors unless the user explicitly approves opportunistic cleanup.

## TypeScript

- Keep `strict` TypeScript.
- Avoid `any`, broad casts, and suppressions.
- Allowed casts should stay at boundaries such as Prisma JSON, external JSON files, DOM APIs, maplibre specs, or third-party library gaps.
- Boundary casts should be followed by validation/normalization before domain use.

## Configuration

- Balance, pacing, retention, timer, registration, military speed, limits, and costs belong in scenario `common/defines.json` when they are scenario policy rather than temporary runtime administration.
- UI text belongs in localization.
- Theme and design values belong in scenario theme tokens.
- Permissions belong in the permission matrix.
- Player-facing guides belong in Arcawiki.
- Technical decisions belong in docs and ADRs.

## Error Handling

- API and WS errors use stable machine-readable codes.
- Player-facing text maps error codes through localization.
- Raw error details are admin/debug-only.
- Service internals may throw or return typed results, but transport boundaries must normalize the response shape.

## Refactoring

Opportunistic refactoring is allowed only after explicit confirmation. If obsolete code is bad but not blocking the task, report it as a follow-up.
