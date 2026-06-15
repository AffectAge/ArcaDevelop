# Server Runtime Agents

Always start from root `AGENTS.md` and `docs/README.md` before using this folder guide.

Use this guide for `apps/server/src/runtime`.

Also read:

- `apps/server/AGENTS.md`
- `docs/folder-structure.md`
- `docs/programming-standards.md`
- `docs/concurrency.md`
- `docs/observability.md`
- `docs/performance-budgets.md`

## Runtime Ownership

This folder is for small runtime primitives and orchestration helpers that are not persistence adapters, route handlers, security policies, map loaders, scenario loaders, or gameplay domain mechanics.

Allowed here:

- bounded runtime caches,
- runtime scheduling helpers,
- server context/orchestration primitives during the `index.ts` split,
- reusable runtime utilities with clear ownership and tests.

Forbidden here:

- Prisma repositories or file persistence adapters; use `apps/server/src/persistence`,
- Express route handlers; use future `apps/server/src/routes`,
- gameplay mechanics; use future `apps/server/src/domain/<mechanic>`,
- security/authz rules; use `apps/server/src/security`,
- scenario format loading/validation; use `apps/server/src/scenarios`,
- broad catch-all helpers.

## Runtime Rules

- Keep primitives bounded and test-covered.
- Name reusable code by stable runtime responsibility.
- Do not add unbounded arrays, queues, caches, or logs.
- Mutating runtime flows must choose a concurrency strategy and document it in final reports.
- Hot-path helpers must avoid hidden full-world scans and should expose clear invalidation when caching.
